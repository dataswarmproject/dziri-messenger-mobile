import React from 'react';
import { Image } from 'expo-image';
import { iconlySources, type IconlyName } from './iconly.generated';

export type { IconlyName };
export function IconlyGlyph({
  name,
  color,
  size = 24,
  mirror = false,
}: {
  name: IconlyName;
  color: string;
  size?: number;
  mirror?: boolean;
}) {
  return (
    <Image
      source={iconlySources[name]}
      contentFit="contain"
      accessible={false}
      tintColor={color}
      style={{ width: size, height: size, transform: mirror ? [{ scaleX: -1 }] : undefined }}
    />
  );
}
