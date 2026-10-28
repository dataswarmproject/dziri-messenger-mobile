const { withFinalizedMod } = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

// The approved PNG is kept intact. Its existing logo margins plus this inset
// place the ring inside Android's 66dp safe zone on the 108dp adaptive layer.
const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground"
            android:insetLeft="18dp" android:insetTop="18dp"
            android:insetRight="18dp" android:insetBottom="18dp" />
    </foreground>
</adaptive-icon>
`;

module.exports = config =>
  withFinalizedMod(config, [
    'android',
    async mod => {
      const directory = join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res/mipmap-anydpi-v26',
      );
      await mkdir(directory, { recursive: true });
      await Promise.all(
        ['ic_launcher.xml', 'ic_launcher_round.xml'].map(name =>
          writeFile(join(directory, name), adaptiveIcon, 'utf8'),
        ),
      );
      return mod;
    },
  ]);
