import { createHash } from "node:crypto";
import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const maxResponseBytes = 20 * 1024 * 1024;
let lastRequestAt = 0;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function enforceRateLimit(source) {
  const delay = Math.max(0, source.minimum_interval_ms - (Date.now() - lastRequestAt));
  if (delay) await wait(delay);
  lastRequestAt = Date.now();
}

function allowedUrl(source, value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !source.allowed_hosts.includes(url.hostname)) {
    throw new Error(`Refusing non-HTTPS or out-of-scope source URL: ${url.href}`);
  }
  return url;
}

export function isPathDisallowed(robotsText, path, userAgent = "ExamSaathiAlertsBot") {
  const groups = [];
  let currentAgents = [];
  let currentRules = [];
  const flush = () => {
    if (currentAgents.length) groups.push({ agents: currentAgents, rules: currentRules });
    currentAgents = [];
    currentRules = [];
  };

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (currentRules.length) flush();
      currentAgents.push(value.toLowerCase());
    } else if ((key === "disallow" || key === "allow") && currentAgents.length) {
      currentRules.push({ kind: key, path: value });
    }
  }
  flush();

  const token = userAgent.toLowerCase().split("/")[0];
  const matching = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || token.includes(agent)),
  );
  const rules = matching.flatMap((group) => group.rules).filter((rule) => rule.path);
  const applicable = rules
    .filter((rule) => path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);
  return applicable[0]?.kind === "disallow";
}

export async function fetchSourceResource(source, inputUrl, { robots = false } = {}) {
  let url = allowedUrl(source, inputUrl).href;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    await enforceRateLimit(source);
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": source.user_agent,
        Accept: robots
          ? "text/plain"
          : "text/html,application/rss+xml,application/atom+xml,application/pdf,application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) throw new Error("Source redirect limit exceeded");
      url = allowedUrl(source, new URL(location, url).href).href;
      continue;
    }
    if (robots && response.status === 404)
      return { status: 404, text: "", buffer: Buffer.alloc(0), contentType: "" };
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Source returned HTTP ${response.status}; blocked sources are not bypassed`,
        );
      }
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maxResponseBytes)
      throw new Error("Source response exceeds the 20 MiB limit");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxResponseBytes)
      throw new Error("Source response exceeds the 20 MiB limit");
    const contentType = response.headers.get("content-type") ?? "";
    return {
      status: response.status,
      buffer,
      contentType,
      text: contentType.includes("pdf") ? "" : buffer.toString("utf8"),
    };
  }
  throw new Error("Source redirect limit exceeded");
}

export async function assertRobotsAllows(source, targetUrl, fetchResource = fetchSourceResource) {
  const response = await fetchResource(source, source.robots_url, { robots: true });
  if (response.status === 404) {
    throw new Error("robots.txt is unavailable; automated access permission is unverified");
  }
  if (isPathDisallowed(response.text, new URL(targetUrl).pathname, source.user_agent)) {
    throw new Error(`robots.txt disallows access to ${new URL(targetUrl).pathname}`);
  }
}

function hashContent(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseHtmlList(source, text) {
  const $ = load(text);
  const items = [];
  $(source.parser.item_selector).each((_index, element) => {
    const href = $(element).attr(source.parser.url_attribute);
    if (!href) return;
    let url;
    try {
      url = allowedUrl(source, new URL(href, source.url).href).href;
    } catch {
      return;
    }
    items.push({
      title: source.parser.title_selector
        ? $(element).find(source.parser.title_selector).text().trim() || $(element).text().trim()
        : $(element).text().trim(),
      url,
      pdf_url: /\.pdf(?:$|[?#])/i.test(url) ? url : null,
      content_hash: hashContent(`${url}\n${$(element).text().trim()}`),
    });
  });
  const uniqueItems = new Map();
  for (const item of items) {
    if (!uniqueItems.has(item.url)) uniqueItems.set(item.url, item);
  }
  return [...uniqueItems.values()];
}

function parseRss(source, text) {
  const parsed = xmlParser.parse(text);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const rows = channel?.item ?? channel?.entry ?? [];
  return (Array.isArray(rows) ? rows : [rows]).flatMap((item) => {
    const linkValue = item.link?.["@_href"] ?? item.link ?? item.guid;
    if (typeof linkValue !== "string") return [];
    let url;
    try {
      url = allowedUrl(source, new URL(linkValue, source.url).href).href;
    } catch {
      return [];
    }
    const title = String(item.title?.["#text"] ?? item.title ?? "").trim();
    const summary = String(item.description ?? item.summary ?? "").trim();
    return [
      {
        title,
        url,
        pdf_url: /\.pdf(?:$|[?#])/i.test(url) ? url : null,
        content_hash: hashContent(`${title}\n${summary}\n${url}`),
      },
    ];
  });
}

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function parseApi(source, text) {
  const payload = JSON.parse(text);
  const records = readPath(payload, source.parser.items_path);
  if (!Array.isArray(records))
    throw new Error("Configured API items_path did not resolve to an array");
  return records.flatMap((record) => {
    try {
      const url = allowedUrl(
        source,
        new URL(readPath(record, source.parser.url_path), source.url).href,
      ).href;
      const title = String(readPath(record, source.parser.title_path) ?? "").trim();
      return [
        {
          title,
          url,
          pdf_url: /\.pdf(?:$|[?#])/i.test(url) ? url : null,
          content_hash: hashContent(JSON.stringify(record)),
        },
      ];
    } catch {
      return [];
    }
  });
}

export function parseSourceList(source, text) {
  if (source.type === "html_list") return parseHtmlList(source, text);
  if (source.type === "rss") return parseRss(source, text);
  if (source.type === "api") return parseApi(source, text);
  throw new Error(`Unsupported source type: ${source.type}`);
}

export function contentHash(buffer) {
  return hashContent(buffer);
}
