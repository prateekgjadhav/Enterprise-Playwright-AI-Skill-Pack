---
id: PAT-overlay
title: Wait for the cookie overlay to be hidden before signing in
defects: DEF-202
---
# Wait for the cookie overlay to be hidden

When a TimeoutError appears waiting for getByRole('button', { name: 'Sign in' }), the cookie overlay is usually
still covering the form. Accept the overlay in the fixture and wait for it to be hidden before clicking sign in.
