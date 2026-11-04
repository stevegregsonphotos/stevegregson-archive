// Steve Gregson Storage — menu bar progress icon.
//
// Built on Steve's Mac by the Storage app (agent.zsh) with Apple's free
// developer tools; no App Store or developer account needed. It only reads
// the progress report the uploader writes (status.json) every 2 seconds and
// never touches any files. "Upload now" starts the uploader straight away.

import AppKit

let appName = "Steve Gregson Storage"
let home = FileManager.default.homeDirectoryForCurrentUser
let supportURL = home.appendingPathComponent("Library/Application Support/\(appName)")
let statusURL = supportURL.appendingPathComponent("status.json")
let rootURL = home.appendingPathComponent(appName)
let logURL = home.appendingPathComponent("Library/Logs/\(appName).log")
let uploaderLabel = "com.stevegregson.storage"

struct Count {
    var files: Int = 0
    var bytes: Int64 = 0
}

struct Report {
    var state = "unknown"
    var updated: TimeInterval = 0
    var total = Count()
    var done = Count()
    var failed = 0
    var waiting = 0
    var tooBig = 0
    var checked = 0
    var current: [String] = []
    var recent: [(at: TimeInterval, path: String)] = []
    var onMac = Count()
    var nextClear: TimeInterval = 0
    var offloadDays = 2
    var server = "https://www.stevegregson.com"
}

func number(_ value: Any?) -> Int64 {
    if let n = value as? NSNumber { return n.int64Value }
    return 0
}

func count(_ value: Any?) -> Count {
    let d = value as? [String: Any] ?? [:]
    return Count(files: Int(number(d["files"])), bytes: number(d["bytes"]))
}

func readReport() -> Report? {
    guard let data = try? Data(contentsOf: statusURL),
          let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
    var r = Report()
    r.state = json["state"] as? String ?? "unknown"
    r.updated = TimeInterval(number(json["updated"]))
    r.total = count(json["total"])
    r.done = count(json["done"])
    r.failed = Int(number(json["failed"]))
    r.waiting = Int(number(json["waiting"]))
    r.tooBig = Int(number(json["tooBig"]))
    r.checked = Int(number(json["checked"]))
    r.current = json["current"] as? [String] ?? []
    for item in json["recent"] as? [[String: Any]] ?? [] {
        if let path = item["path"] as? String {
            r.recent.append((at: TimeInterval(number(item["at"])), path: path))
        }
    }
    r.onMac = count(json["onMac"])
    r.nextClear = TimeInterval(number(json["nextClear"]))
    r.offloadDays = Int(number(json["offloadDays"]))
    if let server = json["server"] as? String, !server.isEmpty { r.server = server }
    return r
}

func size(_ bytes: Int64) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .file
    return formatter.string(fromByteCount: bytes)
}

func plural(_ n: Int, _ word: String) -> String {
    return "\(n) \(word)\(n == 1 ? "" : "s")"
}

/// "Show folder / file.jpg": the last two parts of a path, so names fit.
func shortPath(_ path: String) -> String {
    let parts = path.split(separator: "/")
    return parts.suffix(2).joined(separator: " / ")
}

func ago(_ time: TimeInterval) -> String {
    let seconds = max(0, Date().timeIntervalSince1970 - time)
    if seconds < 60 { return "just now" }
    if seconds < 3600 { return "\(Int(seconds / 60)) min ago" }
    if seconds < 86400 { return "\(Int(seconds / 3600)) hr ago" }
    return "\(Int(seconds / 86400)) days ago"
}

func dateText(_ time: TimeInterval) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_GB")
    formatter.dateFormat = Calendar.current.isDateInToday(Date(timeIntervalSince1970: time)) ? "'today at' HH:mm" : "EEE d MMM 'at' HH:mm"
    return formatter.string(from: Date(timeIntervalSince1970: time))
}

@MainActor
final class StatusController: NSObject, NSMenuDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let menu = NSMenu()
    var report: Report?
    var timer: Timer?

    func start() {
        menu.delegate = self
        menu.autoenablesItems = false
        item.menu = menu
        item.button?.imagePosition = .imageLeading
        refresh()
        timer = Timer.scheduledTimer(timeInterval: 2, target: self, selector: #selector(refresh), userInfo: nil, repeats: true)
    }

    /// No report for 15 minutes while the uploader should run every 5.
    var stale: Bool {
        guard let r = report else { return true }
        return Date().timeIntervalSince1970 - r.updated > 15 * 60
    }

    var remaining: Count {
        guard let r = report else { return Count() }
        return Count(files: max(0, r.total.files - r.done.files), bytes: max(0, r.total.bytes - r.done.bytes))
    }

    @objc func refresh() {
        report = readReport()
        var symbol = "checkmark.icloud"
        var title = ""
        if let r = report {
            if stale {
                symbol = "exclamationmark.icloud"
            } else if r.state == "offline" || r.state == "disconnected" {
                symbol = "icloud.slash"
            } else if r.state == "uploading" && remaining.files > 0 {
                symbol = "icloud.and.arrow.up"
                title = " \(remaining.files)"
            } else if r.state == "waiting" || r.waiting > 0 || r.state == "checking" {
                symbol = "icloud.and.arrow.up"
                title = " …"
            } else if r.failed > 0 {
                symbol = "exclamationmark.icloud"
            }
        } else {
            symbol = "icloud"
        }
        if let button = item.button {
            let image = NSImage(systemSymbolName: symbol, accessibilityDescription: appName)
            image?.isTemplate = true
            button.image = image
            button.title = image == nil && title.isEmpty ? "SG" : title
            button.toolTip = headline()
        }
    }

    func headline() -> String {
        guard let r = report else { return "No upload report yet" }
        if r.state == "offline" { return "Can't reach Storage (offline?)" }
        if r.state == "disconnected" { return "This Mac is disconnected in Backstage" }
        if stale { return "Uploader hasn't checked in since \(dateText(r.updated))" }
        if r.state == "uploading" && remaining.files > 0 {
            return "Uploading \(plural(remaining.files, "file")) · \(size(remaining.bytes)) left"
        }
        if r.state == "checking" { return "Checking for new files… (\(r.checked) so far)" }
        if r.state == "waiting" || r.waiting > 0 { return "Waiting for files to finish copying in" }
        if r.state == "tidying" { return "Checking files to clear from this Mac" }
        return "Everything is uploaded"
    }

    func info(_ text: String, indent: Int = 0) {
        let entry = NSMenuItem(title: text, action: nil, keyEquivalent: "")
        entry.isEnabled = false
        entry.indentationLevel = indent
        menu.addItem(entry)
    }

    func action(_ text: String, _ selector: Selector) {
        let entry = NSMenuItem(title: text, action: selector, keyEquivalent: "")
        entry.target = self
        menu.addItem(entry)
    }

    func build() {
        menu.removeAllItems()
        let bold = NSMenuItem(title: "", action: nil, keyEquivalent: "")
        bold.attributedTitle = NSAttributedString(string: headline(), attributes: [.font: NSFont.boldSystemFont(ofSize: NSFont.systemFontSize)])
        bold.isEnabled = false
        menu.addItem(bold)

        if let r = report {
            if r.state == "uploading" && r.total.files > 0 {
                info("\(r.done.files) of \(r.total.files) done · \(size(r.done.bytes)) of \(size(r.total.bytes))")
            }
            if !r.current.isEmpty {
                menu.addItem(.separator())
                info("Uploading now:")
                for path in r.current.prefix(8) { info(shortPath(path), indent: 1) }
            }
            if r.waiting > 0 { info("\(plural(r.waiting, "file")) still copying in") }
            if r.failed > 0 { info("\(plural(r.failed, "file")) didn't upload; will retry") }
            if r.tooBig > 0 { info("\(plural(r.tooBig, "file")) over 5 GB; can't upload yet") }

            if !r.recent.isEmpty && r.current.isEmpty {
                menu.addItem(.separator())
                info("Recently uploaded:")
                for entry in r.recent.reversed().prefix(5) { info(shortPath(entry.path) + "  (" + ago(entry.at) + ")", indent: 1) }
            }

            menu.addItem(.separator())
            if r.onMac.files > 0 {
                info("On this Mac and safe in Storage: \(plural(r.onMac.files, "file")) (\(size(r.onMac.bytes)))")
                if r.nextClear > 0 {
                    let when = r.nextClear <= Date().timeIntervalSince1970 ? "on the next check" : dateText(r.nextClear)
                    info("Next cleared from this Mac: \(when)", indent: 1)
                }
            } else {
                info("Nothing waiting to be cleared from this Mac")
            }
            info("Files are cleared \(plural(r.offloadDays, "day")) after uploading")
            info("Last checked: \(ago(r.updated))")
        }

        menu.addItem(.separator())
        action("Upload now", #selector(uploadNow))
        action("Open Storage folder", #selector(openFolder))
        action("Open Storage in Backstage", #selector(openBackstage))
        action("Show upload log", #selector(openLog))
        menu.addItem(.separator())
        action("Hide this icon", #selector(quit))
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        report = readReport()
        build()
    }

    func menuDidClose(_ menu: NSMenu) {
        menu.removeAllItems()
    }

    @objc func uploadNow() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        task.arguments = ["kickstart", "gui/\(getuid())/\(uploaderLabel)"]
        try? task.run()
    }

    @objc func openFolder() {
        NSWorkspace.shared.open(rootURL)
    }

    @objc func openBackstage() {
        let server = report?.server ?? "https://www.stevegregson.com"
        if let url = URL(string: server + "/admin/storage/mac") { NSWorkspace.shared.open(url) }
    }

    @objc func openLog() {
        NSWorkspace.shared.open(logURL)
    }

    @objc func quit() {
        // Exits normally, so it stays hidden until the Mac next restarts.
        NSApp.terminate(nil)
    }
}

@main
struct StorageProgressApp {
    @MainActor static var controller: StatusController?

    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let status = StatusController()
        controller = status  // kept for the life of the app
        status.start()
        app.run()
    }
}
