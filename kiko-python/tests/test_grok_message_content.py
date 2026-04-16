import unittest
from types import SimpleNamespace

from grok.message_content import (
    append_text_content,
    extract_image_urls,
    extract_text_content,
    messages_have_image_content,
)


class GrokMessageContentTests(unittest.TestCase):
    def test_extracts_openai_style_text_and_image_url_parts(self):
        content = [
            {"type": "text", "text": "Analyze this post."},
            {"type": "image_url", "image_url": {"url": "https://example.com/post.png"}},
        ]

        self.assertEqual(extract_text_content(content), "Analyze this post.")
        self.assertEqual(extract_image_urls(content), ["https://example.com/post.png"])

    def test_extracts_xai_style_input_parts(self):
        content = [
            {"type": "input_image", "image_url": "https://example.com/chart.jpg"},
            {"type": "input_text", "text": "What does the chart show?"},
        ]

        self.assertEqual(extract_text_content(content), "What does the chart show?")
        self.assertEqual(extract_image_urls(content), ["https://example.com/chart.jpg"])

    def test_append_text_preserves_structured_image_parts(self):
        content = [
            {"type": "text", "text": "Base prompt"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}},
        ]

        updated = append_text_content(content, "\n\nExtra context")

        self.assertEqual(extract_image_urls(updated), ["https://example.com/image.png"])
        self.assertIn("Base prompt", extract_text_content(updated))
        self.assertIn("Extra context", extract_text_content(updated))

    def test_detects_image_content_on_pydantic_like_messages(self):
        messages = [
            SimpleNamespace(role="system", content="Rules"),
            SimpleNamespace(
                role="user",
                content=[
                    {"type": "text", "text": "Look"},
                    {"type": "image_url", "image_url": {"url": "https://example.com/a.png"}},
                ],
            ),
        ]

        self.assertTrue(messages_have_image_content(messages))


if __name__ == "__main__":
    unittest.main()
