
const preprocessMarkdown = (content) => {
    if (!content) return '';

    let processed = content;

    console.log('Original:', JSON.stringify(content));

    // 1. Ensure headers have a preceding newline
    processed = processed.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

    // 2. Ensure lists have a preceding newline
    // Added specific check: capture the list marker more robustly
    processed = processed.replace(/([^\n])\n((-|\*|\d+\.)\s)/g, '$1\n\n$2');

    console.log('Processed:', JSON.stringify(processed));
    return processed;
};

const testCases = [
    "Some text\n- List item 1", // Case 1: Standard missing newline
    "Some text\n* List item 2", // Case 2: Asterisk
    "Some text\n1. Numbered item", // Case 3: Numbered
    "Header line\n# Title", // Case 4: Header
    "Double newline\n\n- List item", // Case 5: Already correct
    "No space\n-Item", // Case 6: No space after dash (Regexp expects space!)
    "Multiple items\n- Item 1\n- Item 2", // Case 7: Only first item needs newline break from text
];

testCases.forEach((t, i) => {
    console.log(`--- Case ${i + 1} ---`);
    preprocessMarkdown(t);
});
