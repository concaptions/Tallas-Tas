import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Button asChild size="lg">
        <h1>TAS Creative Platform</h1>
      </Button>
    </main>
  );
}
