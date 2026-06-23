import { GridBackground } from '@/components/GridBackground';
import { Hero } from '@/components/Hero';
import { LoopSection } from '@/components/LoopSection';
import { ArchSection } from '@/components/ArchSection';
import { Advantages } from '@/components/Advantages';
import { Provenance } from '@/components/Provenance';
import { InstallSection } from '@/components/InstallSection';
import { Ecosystem } from '@/components/Ecosystem';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main className="relative">
      <GridBackground />
      <Hero />
      <LoopSection />
      <ArchSection />
      <Advantages />
      <Provenance />
      <InstallSection />
      <Ecosystem />
      <Footer />
    </main>
  );
}
