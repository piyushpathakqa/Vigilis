import { Composition } from 'remotion';
import { VigilisLoop, VIGILIS_LOOP_FRAMES } from './VigilisLoop';
import { VigilisRefuse, VIGILIS_REFUSE_FRAMES } from './VigilisRefuse';
import { LoomReliability, LOOM_RELIABILITY_FRAMES } from './LoomReliability';
import { VigilisThumb } from './VigilisThumb';

export const RemotionRoot = () => (
  <>
    <Composition
      id="VigilisLoop"
      component={VigilisLoop}
      durationInFrames={VIGILIS_LOOP_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* Square, feed-optimized refusal story for LinkedIn */}
    <Composition
      id="VigilisRefuse"
      component={VigilisRefuse}
      durationInFrames={VIGILIS_REFUSE_FRAMES}
      fps={30}
      width={1080}
      height={1080}
    />
    {/* Static 1920×1080 thumbnail/poster for the loop video */}
    <Composition
      id="VigilisThumb"
      component={VigilisThumb}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* 16:9 talk-track deck for the Loom reliability walkthrough */}
    <Composition
      id="LoomReliability"
      component={LoomReliability}
      durationInFrames={LOOM_RELIABILITY_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
