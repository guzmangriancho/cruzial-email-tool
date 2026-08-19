const ALLOWED_TAGS = new Set([
	"A",
	"B",
	"BR",
	"BLOCKQUOTE",
	"CODE",
	"DIV",
	"EM",
	"H1",
	"H2",
	"H3",
	"H4",
	"HR",
	"I",
	"LI",
	"OL",
	"P",
	"PRE",
	"SPAN",
	"STRONG",
	"TABLE",
	"TBODY",
	"TD",
	"TH",
	"THEAD",
	"TR",
	"U",
	"UL",
]);

const GLOBAL_ATTRS = new Set(["title", "colspan", "rowspan"]);
const LINK_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

function isSafeUrl(value: string) {
	try {
		const url = new URL(value, window.location.origin);
		return LINK_PROTOCOLS.includes(url.protocol);
	} catch {
		return false;
	}
}

function sanitizeNode(node: Node, documentRef: Document): Node | null {
	if (node.nodeType === Node.TEXT_NODE) {
		return documentRef.createTextNode(node.textContent || "");
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return null;
	}

	const element = node as Element;
	const tag = element.tagName.toUpperCase();

	if (!ALLOWED_TAGS.has(tag)) {
		const fragment = documentRef.createDocumentFragment();
		element.childNodes.forEach((child) => {
			const cleanChild = sanitizeNode(child, documentRef);
			if (cleanChild) fragment.appendChild(cleanChild);
		});
		return fragment;
	}

	const cleanElement = documentRef.createElement(tag.toLowerCase());

	Array.from(element.attributes).forEach((attr) => {
		const name = attr.name.toLowerCase();
		const value = attr.value || "";

		if (name.startsWith("on")) return;
		if (name === "style") return;
		if (name === "class") return;

		if (tag === "A" && name === "href") {
			if (!isSafeUrl(value)) return;
			cleanElement.setAttribute("href", value);
			cleanElement.setAttribute("target", "_blank");
			cleanElement.setAttribute("rel", "noopener noreferrer");
			return;
		}

		if (GLOBAL_ATTRS.has(name)) {
			cleanElement.setAttribute(name, value);
		}
	});

	element.childNodes.forEach((child) => {
		const cleanChild = sanitizeNode(child, documentRef);
		if (cleanChild) cleanElement.appendChild(cleanChild);
	});

	return cleanElement;
}

export function sanitizeHtml(html: string) {
	if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
		return "";
	}

	const parser = new DOMParser();
	const parsed = parser.parseFromString(html, "text/html");
	const documentRef = document.implementation.createHTMLDocument("sanitized");
	const container = documentRef.createElement("div");

	parsed.body.childNodes.forEach((node) => {
		const cleanNode = sanitizeNode(node, documentRef);
		if (cleanNode) container.appendChild(cleanNode);
	});

	return container.innerHTML;
}
