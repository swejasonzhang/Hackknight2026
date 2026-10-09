import { motion, useReducedMotion } from 'motion/react'
import { Link, Outlet } from 'react-router-dom'
import { APP_NAME } from '../brand'
import { IconArrowLeft, Logo } from '../components/icons'
import { Blobs } from '../components/landing/Blobs'
import { ease } from '../components/motion'

/** Focused account pages (/signup, /login): one card, the brand, a way back to the landing page. */
export function AuthLayout() {
  const reduce = useReducedMotion()
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <Blobs />
      <header className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center gap-3 px-6 py-5 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5 font-display text-[24px] font-extrabold tracking-wide text-ink uppercase no-underline hover:no-underline">
          <Logo size={34} />
          <span>{APP_NAME}</span>
        </Link>
        <span className="flex-1" />
        <Link to="/" className="btn btn-ghost btn-sm">
          <IconArrowLeft width={15} height={15} /> Back
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <motion.div initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease }} className="w-full max-w-[440px] rounded-sm border border-line border-t-[3px] border-t-primary bg-surface p-7 shadow-pop sm:p-9">
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
