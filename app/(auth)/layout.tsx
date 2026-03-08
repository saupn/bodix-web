import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'BodiX',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 via-primary-dark to-neutral-900 px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="BodiX"
              width={120}
              height={40}
              className="object-contain"
            />
          </Link>
        </div>

        {/* Page content */}
        {children}
      </div>
    </div>
  )
}
