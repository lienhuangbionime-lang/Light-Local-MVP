# Facebook App Review Guide: EchoOrder Live

To allow your app to send Messenger replies to everyone (not just developers), you must submit for **App Review**.

## 1. Permissions to Request
Add these to your submission:
- `pages_messaging` (Required for private and direct replies)
- `pages_read_engagement` (Required to see likes/comments)
- `pages_read_user_content` (Required to read comment text)

## 2. App Settings Configuration
Ensure these are set in the [App Dashboard](https://developers.facebook.com/apps/1623718778816988/settings/basic/):
- **Privacy Policy URL**: `https://light-local-mvp.vercel.app/privacy`
- **Category**: Shopping & Retail (or Business & Utility)
- **App Icon**: Upload a 1024x1024 logo.

## 3. The Screencast (Video)
Meta requires a video demonstration. Use a screen recorder and show:
1. **Login**: Login to your FB account in the browser.
2. **Dashboard**: Show the EchoOrder Live dashboard.
3. **Live Selling**:
   - Go to the FB Page and create a post (or live video).
   - Leave a comment like `A+1` using a test account (must be an App Role while in dev mode).
   - Show the comment appearing in the EchoOrder Live dashboard.
   - Show the automatic Messenger private reply arriving in the customer's inbox.

## 4. Sample Answers for Submission
**How is the app using `pages_messaging`?**
> "The app provides a live selling automation tool. When customers comment with a product code (e.g., A+1) on a Facebook post or live stream, the app automatically captures the order and sends a private reply with a secure checkout link, allowing the seller to close sales efficiently during high-traffic sessions."

**Requested Access Levels**
- Select **Advanced Access** for all three permissions listed above.

## 5. Verification
Facebook may ask to verify your Business. Since you have a Page called "MuMu shop", use your business registration documents if prompted.
