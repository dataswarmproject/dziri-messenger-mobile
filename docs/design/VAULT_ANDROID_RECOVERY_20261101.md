# Android encrypted-journal recovery

The connected phone reported encrypted-storage failures while showing ample
free disk space. The current Expo57 JavaScript AES wrapper accepts Base64 input
in its type declaration and passes it unchanged to native `fromCombined`.
Android's installed `AesCryptoModule` declares that argument as `ByteArray`,
whose JSI converter requires `Uint8Array`. An existing journal therefore failed
to reopen, and subsequent saves also failed while trying to load it.

The adapter now decodes the existing Base64 ciphertext to bytes before calling
`AESSealedData.fromCombined`. The namespace, serialized format, encryption key,
AES-GCM authentication and additional authenticated data remain unchanged. The
fix does not delete, rewrite or reset an unreadable journal.

The regression retains the actual installed Expo AES JavaScript wrapper and
replaces only its native boundary with the Android typed-array contract. Before
the fix, existing-journal reads and reopened saves failed; fresh saves passed.
After the fix all cases pass, including rejection and preservation of tampered
ciphertext. Native file/keystore operations in this test remain synthetic.

Conversation and Marketplace avoid repeating the same storage alert inside the
composer. While storage recovery is needed, its actionable notice takes priority
over the separate unconfirmed-write-access notice. Send authorization checks
remain in force. EN/FR/AR copy now identifies encrypted storage rather than
incorrectly assuming the device is full.

Current local qualification: 277 UI cases across 42 files, native TypeScript,
changed-file lint and the consistency check pass. Physical recovery of the
existing account remains to verify after installing the updated APK. No real
message, Story, report or permission change was used for these tests.
