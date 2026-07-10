import { Composition } from 'remotion';
import { VigilisLoop } from './VigilisLoop';
import { VigilisRefuse, VIGILIS_REFUSE_FRAMES } from './VigilisRefuse';

export const RemotionRoot = () => (
  <>
    <Composition
      id="VigilisLoop"
      component={VigilisLoop}
      durationInFrames={675}
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
  </>
);
