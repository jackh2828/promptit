/**
 * Expo config plugin — iOS Share Extension
 *
 * Wires a native Share Extension target into the managed-workflow Xcode project
 * so users can tap Share → PromptIt in TikTok / Instagram / etc.
 *
 * Flow: extension captures URL → validates it → opens promptit://share?url=<encoded>
 *       → main app's Linking listener navigates to the Save tab with URL pre-filled.
 *
 * Runs automatically during: expo prebuild  |  eas build
 */

const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const EXTENSION_NAME = 'ShareExtension';
const DEPLOYMENT_TARGET = '16.0';

// ─── Embedded Swift source ───────────────────────────────────────────────────
// Kept in sync with ios/ShareExtension/ShareViewController.swift.
// Embedded here so EAS Build can recreate the file without needing the
// gitignored ios/ directory to be committed.

// NOTE: keep this in sync with ios/ShareExtension/ShareViewController.swift.
// The standalone file is the source of truth; this copy is what EAS Build writes
// during expo prebuild (the ios/ directory is gitignored).
const SWIFT_SOURCE = `\
import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private let appScheme = "promptit"
    private var timeoutWorkItem: DispatchWorkItem?
    private var didComplete = false  // guards against double-complete if timeout races a finish

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        startTimeout()
        extractURL()
    }

    // MARK: – UI

    private func setupUI() {
        view.backgroundColor = UIColor(red: 0.031, green: 0.031, blue: 0.059, alpha: 0.95)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false

        let spinner = UIActivityIndicatorView(style: .large)
        spinner.color = UIColor(red: 0.486, green: 0.435, blue: 1.0, alpha: 1)
        spinner.startAnimating()

        let label = UILabel()
        label.text = "Opening PromptIt…"
        label.textColor = UIColor(red: 0.94, green: 0.93, blue: 1.0, alpha: 1)
        label.font = .systemFont(ofSize: 16, weight: .semibold)

        stack.addArrangedSubview(spinner)
        stack.addArrangedSubview(label)
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    // MARK: – Timeout

    // If the item provider hangs the extension will never appear frozen — it
    // auto-cancels after 8 seconds with a clean error.
    private func startTimeout() {
        let item = DispatchWorkItem { [weak self] in
            self?.completeWithError(code: -3, message: "Timed out waiting for shared item.")
        }
        timeoutWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: item)
    }

    private func cancelTimeout() {
        timeoutWorkItem?.cancel()
        timeoutWorkItem = nil
    }

    // MARK: – URL extraction

    private func extractURL() {
        guard
            let item = extensionContext?.inputItems.first as? NSExtensionItem,
            let attachments = item.attachments,
            !attachments.isEmpty
        else {
            completeWithError(code: -1, message: "No shareable item found.")
            return
        }

        let urlType  = UTType.url.identifier
        let textType = UTType.plainText.identifier

        // Scan all attachments: prefer a URL type, fall back to plain text.
        // Checking only the first attachment misses cases where the URL is not
        // the first item (e.g. some apps prepend a thumbnail image attachment).
        var urlProvider: NSItemProvider? = nil
        var textProvider: NSItemProvider? = nil

        for provider in attachments {
            if urlProvider == nil && provider.hasItemConformingToTypeIdentifier(urlType) {
                urlProvider = provider
            }
            if textProvider == nil && provider.hasItemConformingToTypeIdentifier(textType) {
                textProvider = provider
            }
        }

        if let provider = urlProvider {
            provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] item, error in
                // Swift 5.0-compatible explicit binding (not the 5.7 shorthand).
                if let error = error { NSLog("[ShareExtension] loadItem error: \\(error)") }
                let urlString: String?
                switch item {
                case let url as URL:    urlString = url.absoluteString
                case let str as String: urlString = str
                default:               urlString = nil
                }
                DispatchQueue.main.async {
                    if let s = urlString { self?.openInApp(urlString: s) }
                    else { self?.completeWithError(code: -1, message: "Could not read URL from shared item.") }
                }
            }
        } else if let provider = textProvider {
            // Fallback: some apps share the URL as plain text instead of a URL type.
            provider.loadItem(forTypeIdentifier: textType, options: nil) { [weak self] item, _ in
                DispatchQueue.main.async {
                    if let s = item as? String { self?.openInApp(urlString: s) }
                    else { self?.completeWithError(code: -1, message: "Could not read text from shared item.") }
                }
            }
        } else {
            completeWithError(code: -2, message: "Shared item type is not supported.")
        }
    }

    // MARK: – Open main app

    private func openInApp(urlString: String) {
        // Validate before forwarding — prevents captions / hashtags / garbage text
        // from reaching the edge function.
        guard
            let parsed = URL(string: urlString),
            let scheme = parsed.scheme,
            scheme == "http" || scheme == "https"
        else {
            completeWithError(code: -4, message: "The shared text doesn't contain a valid URL.")
            return
        }

        // Build a character set that is safe for use as a query-parameter VALUE.
        // .urlQueryAllowed permits &, =, ?, +, and # unencoded; those characters
        // would split or corrupt the outer \`url=\` parameter when Linking.parse()
        // processes \`promptit://share?url=<value>\` in the main app. Social media
        // URLs routinely contain query strings (TikTok, Instagram, X all do).
        var valueCharset = CharacterSet.urlQueryAllowed
        valueCharset.remove(charactersIn: "&=+?#;")

        guard
            let encoded = parsed.absoluteString.addingPercentEncoding(
                withAllowedCharacters: valueCharset
            ),
            let appURL = URL(string: "\\(appScheme)://share?url=\\(encoded)")
        else {
            completeWithError(code: -1, message: "Failed to build app URL.")
            return
        }

        cancelTimeout()

        extensionContext?.open(appURL) { [weak self] success in
            guard let self = self else { return }
            if success {
                self.finish()
            } else {
                // Returned false — URL scheme not registered (app deleted / bundle ID changed).
                self.completeWithError(code: -5, message: "PromptIt could not be opened.")
            }
        }
    }

    // MARK: – Completion helpers

    private func finish() {
        guard !didComplete else { return }
        didComplete = true
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func completeWithError(code: Int, message: String) {
        guard !didComplete else { return }
        didComplete = true
        cancelTimeout()
        let error = NSError(
            domain: Bundle.main.bundleIdentifier ?? "com.jackhenick.promptit.ShareExtension",
            code: code,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
        extensionContext?.cancelRequest(withError: error)
    }
}
`;

const INFO_PLIST = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>NSExtension</key>
\t<dict>
\t\t<key>NSExtensionAttributes</key>
\t\t<dict>
\t\t\t<key>NSExtensionActivationRule</key>
\t\t\t<dict>
\t\t\t\t<key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
\t\t\t\t<integer>1</integer>
\t\t\t</dict>
\t\t</dict>
\t\t<key>NSExtensionPointIdentifier</key>
\t\t<string>com.apple.share-services</string>
\t\t<key>NSExtensionPrincipalClass</key>
\t\t<string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
\t</dict>
</dict>
</plist>
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Cryptographically random 24-char uppercase hex string matching the Xcode
// UUID format. Math.random() would be fine in practice but crypto eliminates
// any theoretical collision risk across multiple prebuild runs.
function generateUUID() {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

function quoted(str) {
  return `"${str}"`;
}

// ─── Step 1: Write extension source files during prebuild ─────────────────────

function writeExtensionFiles(projectRoot) {
  const dir = path.join(projectRoot, 'ios', EXTENSION_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ShareViewController.swift'), SWIFT_SOURCE, 'utf8');
  fs.writeFileSync(path.join(dir, 'Info.plist'), INFO_PLIST, 'utf8');
}

// ─── Step 2: Add extension target to the Xcode project ───────────────────────

// Find the main application target reliably by product type rather than by
// dict-key order (getFirstTarget() is order-dependent and fragile).
function findMainAppTarget(project, extensionTargetUuid) {
  const targets = project.pbxNativeTargetSection();
  for (const [key, target] of Object.entries(targets)) {
    if (key.endsWith('_comment') || typeof target !== 'object') continue;
    if (key === extensionTargetUuid) continue;
    const pt = target.productType;
    if (
      pt === '"com.apple.product-type.application"' ||
      pt === 'com.apple.product-type.application'
    ) {
      return { uuid: key, pbxNativeTarget: target };
    }
  }
  // Fallback: original getFirstTarget (pre-filtered for non-extension)
  return project.getFirstTarget();
}

function addShareExtensionToProject(project, bundleId, teamId) {
  // Guard: idempotent — skip if the extension target was already added.
  const nativeTargets = project.pbxNativeTargetSection();
  const alreadyExists = Object.values(nativeTargets).some(
    (t) => typeof t === 'object' && t.name === EXTENSION_NAME
  );
  if (alreadyExists) return;

  const extBundleId = `${bundleId}.ShareExtension`;

  // Snapshot all existing XCBuildConfiguration keys BEFORE addTarget runs.
  // Any keys that appear after addTarget must belong to the extension target.
  // This is more reliable than the UUID graph traversal, which breaks when
  // the xcode package stores buildConfigurationList with an inline comment.
  const configKeysBefore = new Set(
    Object.keys(project.pbxXCBuildConfigurationSection())
  );

  // addTarget creates: PBXNativeTarget, PBXBuildConfiguration (Debug + Release),
  // PBXXCConfigurationList, empty build phases (Sources, Resources, Frameworks),
  // a PBXGroup, and a product PBXFileReference for the .appex product.
  const extTarget = project.addTarget(
    EXTENSION_NAME,
    'app_extension',
    EXTENSION_NAME,
    extBundleId
  );

  if (!extTarget?.uuid) {
    throw new Error('[withShareExtension] addTarget() did not return a valid target.');
  }

  // ── Locate the PBXGroup that addTarget created ────────────────────────────
  // addTarget may store the name with or without surrounding quotes depending
  // on the version of the xcode package, so check both forms.
  const pbxGroups = project.hash.project.objects['PBXGroup'] || {};
  let extGroupKey = null;
  for (const [key, group] of Object.entries(pbxGroups)) {
    if (key.endsWith('_comment') || typeof group !== 'object') continue;
    const name = group.name || group.path || '';
    if (
      name === EXTENSION_NAME ||
      name === `"${EXTENSION_NAME}"`
    ) {
      extGroupKey = key;
      break;
    }
  }

  // If addTarget didn't create a group (varies by xcode package version),
  // create one manually and attach it to the project's main group so that
  // addSourceFile always receives a valid group key and never hits a null path.
  if (!extGroupKey) {
    extGroupKey = generateUUID();
    pbxGroups[extGroupKey] = {
      isa: 'PBXGroup',
      children: [],
      name: `"${EXTENSION_NAME}"`,
      sourceTree: '"<group>"',
    };
    pbxGroups[`${extGroupKey}_comment`] = EXTENSION_NAME;
    const projectSection = project.hash.project.objects['PBXProject'] || {};
    const projectKey = Object.keys(projectSection).find(k => !k.endsWith('_comment'));
    if (projectKey) {
      const mainGroupKey = projectSection[projectKey].mainGroup;
      if (mainGroupKey && pbxGroups[mainGroupKey]) {
        if (!Array.isArray(pbxGroups[mainGroupKey].children)) pbxGroups[mainGroupKey].children = [];
        pbxGroups[mainGroupKey].children.push({ value: extGroupKey, comment: EXTENSION_NAME });
      }
    }
  }

  // ── Add ShareViewController.swift to the Sources build phase ─────────────
  // Fully manual implementation — project.addSourceFile() fails silently on
  // some xcode package versions, producing an empty .appex binary (error 90085).
  const swiftFileRefUuid = generateUUID();
  const swiftBuildFileUuid = generateUUID();

  // PBXFileReference — the actual file on disk
  const fileRefsSection = project.hash.project.objects['PBXFileReference'] || {};
  project.hash.project.objects['PBXFileReference'] = fileRefsSection;
  fileRefsSection[swiftFileRefUuid] = {
    isa: 'PBXFileReference',
    lastKnownFileType: 'sourcecode.swift',
    path: '"ShareViewController.swift"',
    sourceTree: '"<group>"',
  };
  fileRefsSection[`${swiftFileRefUuid}_comment`] = 'ShareViewController.swift';

  // PBXBuildFile — the reference used inside build phases
  const buildFilesSection = project.hash.project.objects['PBXBuildFile'] || {};
  project.hash.project.objects['PBXBuildFile'] = buildFilesSection;
  buildFilesSection[swiftBuildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: swiftFileRefUuid,
    fileRef_comment: 'ShareViewController.swift',
  };
  buildFilesSection[`${swiftBuildFileUuid}_comment`] = 'ShareViewController.swift in Sources';

  // Add file reference to the navigator group
  if (extGroupKey && pbxGroups[extGroupKey]) {
    if (!Array.isArray(pbxGroups[extGroupKey].children)) pbxGroups[extGroupKey].children = [];
    pbxGroups[extGroupKey].children.push({ value: swiftFileRefUuid, comment: 'ShareViewController.swift' });
  }

  // addTarget() creates the extension with buildPhases: [] — it does NOT create
  // Sources or Frameworks phases for app_extension targets (confirmed by reading
  // xcode@3.0.1 source: only a CopyFiles phase is added to the MAIN target).
  // We must create both phases manually and attach them to the extension target.

  const extSourcesPhaseUuid = generateUUID();
  const extFrameworksPhaseUuid = generateUUID();

  const sourcesPhaseSection = project.hash.project.objects['PBXSourcesBuildPhase'] || {};
  project.hash.project.objects['PBXSourcesBuildPhase'] = sourcesPhaseSection;
  sourcesPhaseSection[extSourcesPhaseUuid] = {
    isa: 'PBXSourcesBuildPhase',
    buildActionMask: 2147483647,
    files: [{ value: swiftBuildFileUuid, comment: 'ShareViewController.swift in Sources' }],
    runOnlyForDeploymentPostprocessing: 0,
  };
  sourcesPhaseSection[`${extSourcesPhaseUuid}_comment`] = 'Sources';

  const frameworksPhaseSection = project.hash.project.objects['PBXFrameworksBuildPhase'] || {};
  project.hash.project.objects['PBXFrameworksBuildPhase'] = frameworksPhaseSection;
  frameworksPhaseSection[extFrameworksPhaseUuid] = {
    isa: 'PBXFrameworksBuildPhase',
    buildActionMask: 2147483647,
    files: [],
    runOnlyForDeploymentPostprocessing: 0,
  };
  frameworksPhaseSection[`${extFrameworksPhaseUuid}_comment`] = 'Frameworks';

  // Wire both phases into the extension target's buildPhases array
  const extNativeTargetForPhases = project.pbxNativeTargetSection()[extTarget.uuid];
  if (extNativeTargetForPhases) {
    if (!Array.isArray(extNativeTargetForPhases.buildPhases)) extNativeTargetForPhases.buildPhases = [];
    extNativeTargetForPhases.buildPhases.unshift(
      { value: extFrameworksPhaseUuid, comment: 'Frameworks' },
    );
    extNativeTargetForPhases.buildPhases.unshift(
      { value: extSourcesPhaseUuid, comment: 'Sources' },
    );
  }

  // ── Add Info.plist as a file reference in the group ONLY ─────────────────
  // Do NOT use addResourceFile — for app extensions, Info.plist is processed
  // at build time via the INFOPLIST_FILE build setting, not via Copy Bundle
  // Resources. Adding it as a resource creates a duplicate processing step
  // that Xcode warns about.
  const plistRefUuid = generateUUID();
  const fileRefs = project.hash.project.objects['PBXFileReference'] || {};
  fileRefs[plistRefUuid] = {
    isa: 'PBXFileReference',
    lastKnownFileType: 'text.plist.xml',
    path: '"Info.plist"',
    sourceTree: '"<group>"',
  };
  fileRefs[`${plistRefUuid}_comment`] = 'Info.plist';

  if (extGroupKey && pbxGroups[extGroupKey]) {
    const group = pbxGroups[extGroupKey];
    if (!Array.isArray(group.children)) group.children = [];
    group.children.push({ value: plistRefUuid, comment: 'Info.plist' });
  }

  // ── Patch build settings for Debug and Release ────────────────────────────
  // Use the pre/post snapshot diff: any XCBuildConfiguration key that exists
  // now but didn't exist before addTarget() belongs to the extension target.
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const [key, buildConfig] of Object.entries(configurations)) {
    if (configKeysBefore.has(key)) continue; // existed before — skip
    if (key.endsWith('_comment')) continue;
    if (typeof buildConfig !== 'object' || !buildConfig.buildSettings) continue;
    const s = buildConfig.buildSettings;

    s.SWIFT_VERSION = quoted('5.0');
    s.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
    s.TARGETED_DEVICE_FAMILY = quoted('1');
    s.INFOPLIST_FILE = quoted(`${EXTENSION_NAME}/Info.plist`);
    s.PRODUCT_BUNDLE_IDENTIFIER = quoted(extBundleId);
    s.SKIP_INSTALL = 'YES';
    s.SWIFT_EMIT_LOC_STRINGS = 'YES';
    s.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'NO';
    s.APPLICATION_EXTENSION_API_ONLY = 'YES';
    s.DEVELOPMENT_TEAM = teamId;
    // EAS Build disables Xcode automatic provisioning system-wide, so we must
    // use manual signing. The profile is provided via the SHARE_EXTENSION_PROFILE
    // EAS file secret, which was created with EAS's own distribution certificate
    // (serial 503C0F918B45883325EB1D9629BCA024) — confirmed to match.
    const extProfilePath = process.env.SHARE_EXTENSION_PROFILE;
    let extProfileUUID = null;
    if (extProfilePath) {
      try {
        const profileText = fs.readFileSync(extProfilePath, 'utf8');
        const m = profileText.match(/<key>UUID<\/key>\s*<string>([^<]+)<\/string>/);
        extProfileUUID = m ? m[1] : null;
      } catch (_) {}
    }
    if (extProfileUUID) {
      s.CODE_SIGN_STYLE = quoted('Manual');
      s.PROVISIONING_PROFILE_SPECIFIER = quoted(extProfileUUID);
      s.CODE_SIGN_IDENTITY = quoted('Apple Distribution');
    } else {
      // Local dev fallback — no secret configured, let Xcode use automatic.
      s.CODE_SIGN_STYLE = quoted('Automatic');
      delete s.PROVISIONING_PROFILE_SPECIFIER;
      delete s.CODE_SIGN_IDENTITY;
    }
    delete s.CODE_SIGN_ENTITLEMENTS;
  }

  // ── Find the main app target reliably ─────────────────────────────────────
  const mainTarget = findMainAppTarget(project, extTarget.uuid);
  if (!mainTarget?.uuid) {
    throw new Error('[withShareExtension] Could not find the main application target.');
  }

  // ── Retrieve the extension product file reference (.appex) ───────────────
  const extNativeTargetObj = project.pbxNativeTargetSection()[extTarget.uuid];
  const extProductRefUuid = extNativeTargetObj?.productReference;
  if (!extProductRefUuid) {
    throw new Error('[withShareExtension] Extension target has no productReference.');
  }

  // ── Create PBXBuildFile pointing to the .appex product ───────────────────
  const buildFileUuid = generateUUID();
  const buildFileComment = `${EXTENSION_NAME}.appex in Embed App Extensions`;
  // Guard: PBXBuildFile section should always exist in a valid Expo project,
  // but the || {} ensures we never throw on an unusual project layout.
  if (!project.hash.project.objects['PBXBuildFile']) {
    project.hash.project.objects['PBXBuildFile'] = {};
  }
  const buildFiles = project.hash.project.objects['PBXBuildFile'];
  buildFiles[buildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: extProductRefUuid,
    fileRef_comment: `${EXTENSION_NAME}.appex`,
    settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
  };
  buildFiles[`${buildFileUuid}_comment`] = buildFileComment;

  // ── Create "Embed App Extensions" PBXCopyFilesBuildPhase ─────────────────
  // dstSubfolderSpec 13 = PlugIns (the slot Xcode uses for app extensions).
  // Guard against duplicates in case addTarget already created an embed phase.
  const embedPhaseComment = 'Embed App Extensions';
  const copyFilesPhases = project.hash.project.objects['PBXCopyFilesBuildPhase'] || {};
  project.hash.project.objects['PBXCopyFilesBuildPhase'] = copyFilesPhases;
  const mainTargetObj = project.pbxNativeTargetSection()[mainTarget.uuid];

  const alreadyEmbedded = mainTargetObj?.buildPhases?.some((phase) => {
    const phaseObj = copyFilesPhases[phase.value];
    return (
      phaseObj?.dstSubfolderSpec === 13 &&
      phaseObj?.files?.some((f) => f.comment?.includes(EXTENSION_NAME))
    );
  }) ?? false;

  if (!alreadyEmbedded) {
    const embedPhaseUuid = generateUUID();
    copyFilesPhases[embedPhaseUuid] = {
      isa: 'PBXCopyFilesBuildPhase',
      buildActionMask: 2147483647,
      dstPath: quoted(''),
      dstSubfolderSpec: 13,
      files: [{ value: buildFileUuid, comment: buildFileComment }],
      name: quoted(embedPhaseComment),
      runOnlyForDeploymentPostprocessing: 0,
    };
    copyFilesPhases[`${embedPhaseUuid}_comment`] = embedPhaseComment;
    if (mainTargetObj && Array.isArray(mainTargetObj.buildPhases)) {
      mainTargetObj.buildPhases.push({ value: embedPhaseUuid, comment: embedPhaseComment });
    }
  }

  // ── Make the extension a build dependency of the main target ─────────────
  // Ensures the extension is compiled before the main app links.
  const dependencyUuid = generateUUID();
  const proxyUuid = generateUUID();

  const proxies = project.hash.project.objects['PBXContainerItemProxy'] || {};
  project.hash.project.objects['PBXContainerItemProxy'] = proxies;
  proxies[proxyUuid] = {
    isa: 'PBXContainerItemProxy',
    containerPortal: project.hash.project.rootObject,
    containerPortal_comment: 'Project object',
    proxyType: 1,
    remoteGlobalIDString: extTarget.uuid,
    remoteInfo: quoted(EXTENSION_NAME),
  };

  const deps = project.hash.project.objects['PBXTargetDependency'] || {};
  project.hash.project.objects['PBXTargetDependency'] = deps;
  deps[dependencyUuid] = {
    isa: 'PBXTargetDependency',
    name: quoted(EXTENSION_NAME),
    target: extTarget.uuid,
    target_comment: EXTENSION_NAME,
    targetProxy: proxyUuid,
    targetProxy_comment: 'PBXContainerItemProxy',
  };
  deps[`${dependencyUuid}_comment`] = 'PBXTargetDependency';

  if (mainTargetObj && Array.isArray(mainTargetObj.dependencies)) {
    mainTargetObj.dependencies.push({ value: dependencyUuid, comment: 'PBXTargetDependency' });
  }
}

// ─── Plugin export ────────────────────────────────────────────────────────────

module.exports = function withShareExtension(config) {
  // Phase 1 – write Swift + plist files into ios/ShareExtension/
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      writeExtensionFiles(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);

  // Phase 2 – modify the generated Xcode project
  config = withXcodeProject(config, (cfg) => {
    const bundleId =
      cfg.ios?.bundleIdentifier ??
      cfg.modRequest?.config?.ios?.bundleIdentifier ??
      'com.jackhenick.promptit';
    const teamId =
      cfg.ios?.appleTeamId ??
      cfg.modRequest?.config?.ios?.appleTeamId ??
      'S7827V325R';
    addShareExtensionToProject(cfg.modResults, bundleId, teamId);
    return cfg;
  });

  // Phase 3 – install the ShareExtension provisioning profile on EAS build servers.
  // The profile is stored as an EAS file secret (SHARE_EXTENSION_PROFILE). EAS writes
  // the file to a temp path before running prebuild. We copy it into the standard
  // provisioning profiles directory so Xcode can find it by UUID.
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const profilePath = process.env.SHARE_EXTENSION_PROFILE;
      if (!profilePath) return cfg;
      try {
        const os = require('os');
        const profileData = fs.readFileSync(profilePath);
        const profileText = profileData.toString('utf8');
        const m = profileText.match(/<key>UUID<\/key>\s*<string>([^<]+)<\/string>/);
        const uuid = m ? m[1] : null;
        if (uuid) {
          const profileDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
          fs.mkdirSync(profileDir, { recursive: true });
          fs.writeFileSync(path.join(profileDir, `${uuid}.mobileprovision`), profileData);
        }
      } catch (_) {}
      return cfg;
    },
  ]);

  // Phase 4 – patch Podfile to sign resource bundle targets (Xcode 14+ requirement).
  // CocoaPods allows only ONE post_install block, so inject inside the existing one
  // rather than appending a second block.
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const teamId =
        cfg.ios?.appleTeamId ??
        cfg.modRequest?.config?.ios?.appleTeamId ??
        'S7827V325R';
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes('RESOURCE_BUNDLE_SIGNING_FIX')) return cfg; // idempotent
      const injection = `  # RESOURCE_BUNDLE_SIGNING_FIX — Xcode 14+ requires every resource bundle target to have a team
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['DEVELOPMENT_TEAM'] = '${teamId}'
      config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
    end
  end\n`;
      if (podfile.includes('post_install do |installer|')) {
        // Inject at the top of the existing block so RN post-install hooks still run
        podfile = podfile.replace(
          'post_install do |installer|\n',
          `post_install do |installer|\n${injection}`
        );
      } else {
        podfile += `\npost_install do |installer|\n${injection}end\n`;
      }
      fs.writeFileSync(podfilePath, podfile, 'utf8');
      return cfg;
    },
  ]);

  return config;
};
