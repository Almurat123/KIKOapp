# 知识库 (RAG) 机制

由于加密货币领域的信息变化极快，且新的协议层出不穷，KiKo 采用了 **检索增强生成 (Retrieval-Augmented Generation, RAG)** 技术来增强 Grok 的专业深度。

## 为什么需要 RAG？

即使是像 Grok 这样强大的 LLM，其训练数据也存在截止日期。通过 RAG，我们可以：
- 注入最新的 API 文档（如 LlamaIndex, Alchemy 的最新接口）。
- 存储 KiKo 项目自身的私有文档，让 AI 能够回答“KiKo 是如何处理滑动点差的？”这类内部问题。

## 技术实现

1. **向量存储 (ChromaDB)**: 我们使用本地化的 ChromaDB 实例。
2. **文档分片 (Chunks)**: 将长文档切分为 500-1000 字符的片段。
3. **嵌入 (Embeddings)**: 使用高效的嵌入模型将文本转化为向量。
4. **检索逻辑**:
   - 当用户提出一个偏技术的问题时，系统会先在向量数据库中计算余弦相似度。
   - 提取排名前 3-5 的相关片段。
   - 作为 Context 拼接到 Prompt 中发送给 Grok。

## 如何维护知识库？

开发者可以通过 `kiko-python/rag` 目录下的自动化脚本进行文档入库：
- 支持 PDF, Markdown, HTML 抓取。
- 建议定期更新 `chroma_db` 文件夹以包含最新的 DeFi 协议规范。

---

> [!NOTE]
> RAG 的启用与否由 `router.py` 中的 `kb_search` 开关控制。默认情况下，针对通用问题的流量会自动开启检索。
