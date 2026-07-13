const normalizedSummary = (value) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const openTableOfContents = (node) => {
  if (!node || !Array.isArray(node.children)) {
    return;
  }

  if (node.type === "paragraph") {
    const details = node.children.find(
      (child) => child.type === "html" && child.value === "<details>",
    );
    const summaryText = node.children.find(
      (child) =>
        child.type === "text" &&
        ["table of contents", "open table of contents"].includes(
          normalizedSummary(child.value),
        ),
    );

    if (details && summaryText) {
      details.value = "<details open>";
      summaryText.value = "Table of contents";
    }
  }

  node.children.forEach(openTableOfContents);
};

export default function remarkOpenToc() {
  return openTableOfContents;
}
