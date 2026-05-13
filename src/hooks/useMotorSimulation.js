import { useMemo } from 'react'
import { calculateMotor } from '../utils/motorCalculations.js'

export function useMotorSimulation(params, autoOperatingPoint, frequencyReactanceScaling) {
  return useMemo(
    () => calculateMotor(params, autoOperatingPoint, frequencyReactanceScaling),
    [params, autoOperatingPoint, frequencyReactanceScaling],
  )
}
