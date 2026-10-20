import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// হিস্টরি অনুযায়ী এক ধাপ পিছনে যায়; হিস্টরি না থাকলে Fly Arena হোমে ফেরে।
export function BackButton({ fallback = '/study', label = 'হোম' }: { fallback?: string; label?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: fallback });
  };
  return <Button variant="ghost" onClick={goBack} aria-label="পিছনে ফিরুন"><ArrowLeft /><span>{label}</span></Button>;
}
