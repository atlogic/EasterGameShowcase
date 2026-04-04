# Easter Egg Hunt 🥚

An epic outdoor game for children, youth, and adults. Hide eggs, create adventures, and make your children have great fun during the holidays!

## Features
- Create custom routes with riddles and tasks.
- Generate and print unique QR codes for each checkpoint.
- Real-time game progress tracking.
- Photo and audio task confirmation.
- Multi-language support (Polish, English).
- Parent panel for game management and history.

## Security Notice
This repository is configured to use environment variables for sensitive information. **Never commit your `.env` file or Firebase configuration files to version control.**

## Setup

### 1. Firebase Configuration
You need a Firebase project with:
- **Firestore Database**
- **Firebase Authentication** (Google Sign-in and Email/Password enabled)

### 2. Environment Variables
Create a `.env` file in the root directory based on `.env.example`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)
```

### 3. Firestore Rules
Deploy the rules from `firestore.rules` to your Firebase project.

### 4. Installation
```bash
npm install
npm run dev
```

## Deployment
This app is ready to be deployed to Cloudflare Pages or any other static site hosting. Ensure you set the environment variables in your hosting provider's dashboard.

## License
MIT
