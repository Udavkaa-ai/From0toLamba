import { useRef, useEffect, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface SpinningModelProps {
  url: string                  // путь до .glb
  position?: [number, number, number]
  scale?: number | [number, number, number]
  rotationSpeed?: number       // рад/сек вокруг оси Y
  spinPhase?: number           // начальная фаза вращения (синхронизировать группой)
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  /** Опциональный поворот вокруг X (например, наклон ключа) */
  tiltX?: number
  /** Авто-нормализация — модель центрируется и масштабируется в единичный куб */
  normalize?: boolean
}

/**
 * Универсальный компонент: грузит GLB, нормализует размер, постоянно вращается
 * вокруг вертикальной оси. Кликабелен (поднимает событие, родитель решает,
 * правильный ли это объект).
 */
export function SpinningModel({
  url, position = [0, 0, 0], scale = 1, rotationSpeed = 0.7,
  spinPhase = 0, onClick, tiltX = 0, normalize = true,
}: SpinningModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const gltf = useGLTF(url) as any

  // Клонируем сцену чтобы можно было параллельно показывать ту же модель в нескольких местах
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    if (normalize) {
      // Центрируем и масштабируем модель в bounding-куб ~единичный
      const box = new THREE.Box3().setFromObject(cloned)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z) || 1
      cloned.position.sub(center)
      cloned.scale.setScalar(1 / maxDim)
    }
    return cloned
  }, [gltf, normalize])

  useEffect(() => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = spinPhase
  }, [spinPhase])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += rotationSpeed * delta
  })

  const scaleArr: [number, number, number] = Array.isArray(scale)
    ? scale
    : [scale, scale, scale]

  return (
    <group position={position} scale={scaleArr} onClick={onClick}>
      <group ref={groupRef} rotation={[tiltX, 0, 0]}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

/** Преlоадка ассета: вызвать заранее, чтобы переход в игру был мгновенным. */
export function preloadModel(url: string) {
  useGLTF.preload(url)
}
