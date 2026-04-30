import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXTRACTIONS_PER_HOUR = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("twitter.com") || url.includes("x.com")) return "X/Twitter";
  if (url.includes("reddit.com")) return "Reddit";
  return "Other";
}

async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchPageMetadata(url: string): Promise<{ title: string; description: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    const html = await res.text();
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    const metaTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
    const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
    return { title: ogTitle || metaTitle, description: ogDesc || metaDesc };
  } catch {
    return { title: "", description: "" };
  }
}

// ─── Reddit ───────────────────────────────────────────────────────────────────

async function getRedditAudioUrl(url: string): Promise<string | null> {
  try {
    const jsonUrl = url.split("?")[0].replace(/\/$/, "") + ".json";
    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": "PromptIt/1.0" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const post = json[0]?.data?.children?.[0]?.data;
    const videoUrl: string | undefined =
      post?.secure_media?.reddit_video?.fallback_url ??
      post?.media?.reddit_video?.fallback_url;
    if (!videoUrl) return null;
    const base = videoUrl.split("/DASH_")[0];
    return `${base}/DASH_audio.mp4`;
  } catch {
    return null;
  }
}

// ─── TikTok via RapidAPI ──────────────────────────────────────────────────────

async function getTikTokVideoUrl(url: string): Promise<string | null> {
  if (!RAPIDAPI_KEY) return null;
  try {
    const res = await fetch(
      `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(url)}&hd=1`,
      {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "tiktok-video-no-watermark2.p.rapidapi.com",
        },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.play ?? json?.data?.wmplay ?? null;
  } catch {
    return null;
  }
}

// ─── YouTube via captions ─────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    // Fetch the video page to get caption track URLs
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    const html = await pageRes.text();

    // Extract caption track URL from page data
    const captionMatch = html.match(/"captionTracks":\[.*?"baseUrl":"([^"]+)"/);
    if (!captionMatch) return null;

    const captionUrl = captionMatch[1].replace(/\\u0026/g, "&");
    const captionRes = await fetch(captionUrl);
    const xml = await captionRes.text();

    // Parse XML captions into plain text
    const text = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

// ─── Whisper transcription ────────────────────────────────────────────────────

async function transcribeAudio(audioUrl: string): Promise<string> {
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Could not download audio: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();
  if (audioBuffer.byteLength > 24 * 1024 * 1024) throw new Error("Audio too large (> 24 MB)");

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: "audio/mp4" }), "audio.mp4");
  form.append("model", "whisper-1");
  form.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error: ${await res.text()}`);
  return (await res.json()).text ?? "";
}

// ─── GPT extraction ───────────────────────────────────────────────────────────

async function extractPromptWithGPT(params: {
  platform: string;
  transcription?: string;
  pageTitle: string;
  pageDescription: string;
}): Promise<{ title: string; content: string }> {
  const { platform, transcription, pageTitle, pageDescription } = params;
  const hasAudio = transcription && transcription.trim().length > 30;

  const context = hasAudio
    ? `Video transcription:\n"""\n${transcription}\n"""`
    : `Page title: ${pageTitle}\nPage description: ${pageDescription}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract AI prompts from social media video content. " +
            "The user saw a video showing someone use an AI prompt and wants to save it. " +
            'Return JSON with "title" (max 60 chars) and "content" (the exact prompt text ready to paste into ChatGPT or Claude). ' +
            'If uncertain, prefix content with "[Review needed] ".',
        },
        { role: "user", content: `Platform: ${platform}\n${context}\n\nExtract the AI prompt.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`GPT error: ${await res.text()}`);
  return JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    // Get calling user from JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const { url } = await req.json();
    if (!url) throw new Error("url is required");

    // ── Rate limiting ──────────────────────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("prompts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= MAX_EXTRACTIONS_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: "You've saved a lot of prompts this hour. Take a breather and try again soon." }),
        { status: 429, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Cache lookup ───────────────────────────────────────────────────────
    const urlHash = await hashUrl(url);
    const { data: cached } = await supabase
      .from("extraction_cache")
      .select("title, content, platform, transcribed")
      .eq("url_hash", urlHash)
      .single();

    if (cached?.content) {
      return new Response(
        JSON.stringify({ ...cached, fromCache: true }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Extract ────────────────────────────────────────────────────────────
    const platform = detectPlatform(url);
    const metadata = await fetchPageMetadata(url);
    let transcription: string | undefined;

    if (platform === "Reddit") {
      const audioUrl = await getRedditAudioUrl(url);
      if (audioUrl) transcription = await transcribeAudio(audioUrl);
    } else if (platform === "TikTok") {
      const videoUrl = await getTikTokVideoUrl(url);
      if (videoUrl) transcription = await transcribeAudio(videoUrl);
    } else if (platform === "YouTube") {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        const captions = await getYouTubeTranscript(videoId);
        if (captions) transcription = captions;
      }
    }

    const { title, content } = await extractPromptWithGPT({
      platform,
      transcription,
      pageTitle: metadata.title,
      pageDescription: metadata.description,
    });

    const result = { title, content, platform, transcribed: !!transcription };

    // ── Store in cache ─────────────────────────────────────────────────────
    await supabase.from("extraction_cache").insert({
      url_hash: urlHash,
      url: url.trim(),
      ...result,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
