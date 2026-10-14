import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Agentation } from 'agentation';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'EPUB to Audio Reader | OpenAI TTS',
  description: 'Trình đọc sách EPUB sang Audio với OpenAI Speech TTS và Auto-Next liên tục',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden flex flex-col">{children}</body>
      <Agentation endpoint="http://localhost:4747" />
    </html>
  );
}
