# Video Background Synchronization

Using pre-rendered video clips (.mp4, .webm) as backgrounds or composited elements in Remotion requires understanding how Remotion extracts frames to ensure perfect synchronization with overlaid UI elements.

## The `<OffthreadVideo>` Component

Never use the standard HTML5 `<video>` tag for actual video generation. The standard `<video>` tag is non-deterministic; network buffering, decoding speed, and browser throttling will cause frames to drop or drift out of sync with Remotion's `useCurrentFrame()`.

**Always use `<OffthreadVideo>`**.

Behind the scenes, `<OffthreadVideo>` uses FFmpeg to extract exact frames from the source video file *outside* the browser environment. It then passes these exact image frames into the browser, guaranteeing perfect frame accuracy.

### Basic Setup

```tsx
import { OffthreadVideo } from 'remotion';

export const CompositedScene: React.FC = () => {
    return (
        <div style={{ position: 'relative', width: 1920, height: 1080 }}>
            {/* The Background */}
            <OffthreadVideo 
                src="https://example.com/background.mp4" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            
            {/* Foregound UI synced perfectly */}
            <div style={{ position: 'absolute', top: 0, left: 0 }}>
                <AnimatedChatInterface />
            </div>
        </div>
    );
}
```

## Advanced Controls

### Trimming and Slicing
You can specify exactly which part of the source video to use using `startFrom` and `endAt`. This is crucial for creating loops or selecting specific highlights.

### Pre-fetching & Flickering (Development Only)
In the Remotion Studio preview, `<OffthreadVideo>` falls back to standard HTML5 video playback for performance. Because of this, you might see "flickering" or a black flash when the video starts, as the browser buffers.

*   This flickering **will not** appear in the final rendered video (`npx remotion render`).
*   To minimize dev flickering, you can use the `pauseWhenBuffering` prop, or preload the video invisibly.

## Handling Alpha Channels (Transparent Videos)

If you have a video element meant to loop *over* another background (e.g., a green-screened actor or an effect exported from After Effects):

1.  Export the source video in a format supporting Alpha: **WebM (VP8/VP9)** or **Apple ProRes 4444 (.mov)**.
2.  Import via `<OffthreadVideo>`: Remotion natively supports transparency in OffthreadVideo if the source file contains an alpha channel.

*Note: MP4 (H.264/H.265) does NOT support alpha channels officially.*
