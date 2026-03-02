# The Skill Matrix: Parametric & Data-Driven Video Architecture

To build advanced applications ("各种技能的矩阵")—like dynamic video templates, personalized marketing videos, or AI-generated news reports—you must architect your Remotion project as a **Parametric Video Engine**.

The core concept: **The video is just a render function that takes JSON as arguments.**

## 1. Schema-Driven Input (`zod`)

Every dynamic composition must define exactly what data it requires to render. This is done in the entry point (`Root.tsx`) using Zod schemas.

```tsx
import { Composition } from 'remotion';
import { z } from 'zod';

const NewsReportSchema = z.object({
  headline: z.string(),
  anchorVideoUrl: z.string().url(),
  backgroundType: z.enum(['studio', 'field', 'abstract']),
  showLowerThird: z.boolean(),
  bRollClips: z.array(z.string().url())
});

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="AIGeneratedNews"
            component={NewsComponent}
            schema={NewsReportSchema}
            defaultProps={{
                headline: "Default Headline",
                anchorVideoUrl: "...",
                backgroundType: "studio",
                showLowerThird: true,
                bRollClips: []
            }}
            // ... configuration
        />
    )
}
```

## 2. Dynamic Timing (`calculateMetadata`)

If the video length depends on the input data (e.g., an audio voiceover file of variable length), you cannot use a static `durationInFrames`. You must calculate the duration asynchronously before the render starts.

```tsx
<Composition
    // ...
    calculateMetadata={async ({ props }) => {
        // Fetch audio length, calculate reading time, etc.
        const audioDuration = await getAudioDurationInSeconds(props.audioUrl);
        return {
            durationInFrames: Math.ceil(audioDuration * 30),
            props // pass modified or fetched props down
        };
    }}
/>
```

## 3. The Node Graph / Composition Matrix

While Remotion doesn't have a visual UI node graph, you build the programmatic equivalent using `<Series>` and `<Sequence>`.

By mapping over your JSON data, you generate a dynamic timeline of "nodes".

```tsx
import { Series } from 'remotion';

export const DynamicTimeline = ({ jsonPayload }) => {
    return (
        <Series>
            {jsonPayload.clips.map((clipData, index) => (
                <Series.Sequence 
                    key={index} 
                    durationInFrames={clipData.duration}
                >
                    {/* Render specific component based on 'type' */}
                    {clipData.type === 'title' && <TitleNode data={clipData} />}
                    {clipData.type === 'video' && <VideoNode data={clipData} />}
                    {clipData.type === '3d_model' && <ThreeDNode data={clipData} />}
                </Series.Sequence>
            ))}
        </Series>
    );
}
```

## 4. Automation & Scalability (Node.js API)

The true power of this matrix is hitting it via an API backend. Your Node.js server receives a request, generates the JSON payload, bundles the Remotion project, and triggers the render via `@remotion/lambda` or `@remotion/renderer`.

```javascript
// Backend endpoint example
app.post('/generate-video', async (req, res) => {
    const userPrompt = req.body.prompt;
    
    // 1. LLM / Logic creates the JSON 'Skill Matrix' payload
    const renderConfig = generateCompositionData(userPrompt);
    
    // 2. Render the video programmatically
    const result = await renderMedia({
        composition: {
            id: 'AIGeneratedNews',
            props: renderConfig // Pass the JSON here
        },
        serveUrl: bundledAppUrl,
        codec: 'h264'
    });
    
    res.json(result);
});
```
