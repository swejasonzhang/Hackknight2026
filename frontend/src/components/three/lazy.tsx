import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { ArmSceneProps } from './ArmScene'
import type { JointSceneProps } from './JointScene'
import type { ProgressSceneProps } from './ProgressScene'

/*
 * three.js is code-split: these wrappers load the scenes on demand and show a lightweight
 * fallback meanwhile (and forever, in environments without WebGL such as the test runner).
 */
const JointSceneImpl = lazy(() => import('./JointScene'))
const ArmSceneImpl = lazy(() => import('./ArmScene'))
const ProgressSceneImpl = lazy(() => import('./ProgressScene'))

export function LazyJointScene({ fallback = null, ...props }: JointSceneProps & { fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <JointSceneImpl {...props} />
    </Suspense>
  )
}

export function LazyArmScene({ fallback = null, ...props }: ArmSceneProps & { fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <ArmSceneImpl {...props} />
    </Suspense>
  )
}

export function LazyProgressScene({ fallback = null, ...props }: ProgressSceneProps & { fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <ProgressSceneImpl {...props} />
    </Suspense>
  )
}

/** Catches a scene that cannot start (no WebGL, lost context) and shows a fallback instead. */
export class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError?.()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
