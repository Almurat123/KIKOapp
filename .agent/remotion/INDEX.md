# Remotion Expert Knowledge Base

This knowledge base goes beyond the basic documentation to explore the internal workings, advanced orchestration, and specialized techniques for building cutting-edge video applications with Remotion.

## Core Concepts & Source Code Analysis
- [Core Architecture](./architecture.md): How Remotion calculates frames, passes React context, and orchestrates the `<Composition>`.
- [Rendering Pipeline](./rendering_pipeline.md): Deep dive into `@remotion/cli`, `@remotion/lambda`, Chrome Headless Shell, and FFMPEG integration.
- [State & Determinism](./determinism.md): Managing asynchronous data, random numbers, and external media perfectly across render threads.

## Advanced Capabilities (The "Better Apps" Frontier)
- [3D Integration & WebGL](./3d_webgl.md): Fixing context loss, perfectly syncing `@react-three/fiber` with `useCurrentFrame()`.
- [Masking & Chromakey (抠图)](./masking_chromakey.md): Techniques for isolating subjects from video backgrounds using Canvas, WebGL shaders, or CSS Alpha masks.
- [Video Background Synchronization](./video_backgrounds.md): Ensuring `<OffthreadVideo>` and remote MP4s never drift out of sync with overlaid UI.
- [Skill Matrices & Node Graphs](./skill_matrix.md): Architectural patterns for building node-based video editors or parametric video generators (JSON to Video).
