# UniMarket - Campus Marketplace 🎓🛒

UniMarket is a modern, secure, and feature-rich campus marketplace designed specifically for university students and vendors. It facilitates buying, selling, and auctioning products within a trusted community, complemented by a vibrant community board for campus discussions.

## 🚀 Key Features

### 🛍️ Marketplace
- **Buy & Sell**: List items for fixed prices or participate in real-time auctions.
- **Bento-Style Discovery**: A beautifully designed homepage featuring trending categories, featured items, and live auctions.
- **Advanced Search & Filtering**: Find exactly what you need with dynamic category filtering and keyword search.
- **Secure Cart & Checkout**: Integrated shopping cart with a streamlined checkout process.

### 🤝 Community & Trust
- **Community Board**: A space for students to share notes, ask questions, and connect.
- **Verified Users**: Built-in trust through university email verification and user profiles.
- **Escrow System**: Secure transaction handling to ensure both buyers and sellers are protected.
- **Real-time Notifications**: Stay updated on bids, sales, and community interactions.

### 👨‍💼 Vendor & Admin Tools
- **Vendor Dashboard**: Comprehensive tools for vendors to manage listings, track sales, and request withdrawals.
- **Admin Panel**: Centralized management for administrators to oversee the marketplace and process withdrawal requests.
- **Financial Ledger**: Transparent tracking of transactions and balances.

### 💳 Financial & Backend Systems
- **Wallet & Ledger**: Every user has a digital wallet to manage their earnings and purchases.
- **Escrow Protection**: Funds are held in escrow until the buyer confirms receipt of the item, ensuring a safe transaction for both parties.
- **Paystack Integration**: Seamless payment processing for secure transactions.
- **Automated Auctions**: Cron-based tasks handle auction closings and winner notifications.
- **Real-time Chat**: Direct communication between buyers and sellers to negotiate and coordinate pickups.
- **Verification System**: Automated verification for university emails to maintain a secure campus environment.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend/Database**: [Firebase](https://firebase.google.com/) (Firestore, Authentication, Storage)
- **Payment Gateway**: [Paystack](https://paystack.com/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

## 🏗️ System Architecture

### Frontend
The application is built using the Next.js App Router, prioritizing performance and SEO. It utilizes client-side components for interactivity (like real-time auctions and chat) and server-side logic where appropriate.

### Backend (Serverless)
- **Firestore**: A NoSQL document database used for storing products, users, transactions, and community posts.
- **Firebase Auth**: Handles secure user authentication (Email/Password and Google Login).
- **Firebase Storage**: Securely hosts product images with strict access rules.
- **API Routes**: Next.js API routes handle sensitive operations like:
  - **Wallet Management**: Securely processing deposits and withdrawals.
  - **Escrow Logic**: Managing the release of funds based on transaction status.
  - **Auction Closing**: Automated scripts to finalize auctions and notify winners.
  - **Payment Verification**: Integrating with Paystack to confirm successful transactions.

### Security
- **Firestore Rules**: Granular security rules ensure that users can only access and modify data they are authorized to.
- **Storage Rules**: Protects user uploads, ensuring only owners can modify their files.
- **Role-Based Access Control (RBAC)**: Distinct permissions for Users, Vendors, and Admins.

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd unimarket
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configuration**:
   - Create a `firebase-applet-config.json` in the root directory with your Firebase project credentials:
     ```json
     {
       "apiKey": "YOUR_API_KEY",
       "authDomain": "YOUR_AUTH_DOMAIN",
       "projectId": "YOUR_PROJECT_ID",
       "storageBucket": "YOUR_STORAGE_BUCKET",
       "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
       "appId": "YOUR_APP_ID",
       "firestoreDatabaseId": "(default)"
     }
     ```
   - Copy `.env.example` to `.env` and fill in any required environment variables.

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### For Students (Buyers/Sellers)
- **Listing an Item**: Navigate to "List Item", fill in the details, upload images, and choose between a fixed price or an auction.
- **Buying**: Browse the marketplace, add items to your cart, and proceed to checkout.
- **Bidding**: On auction items, enter your bid. You'll be notified if you're outbid.

### For Vendors
- **Dashboard**: Access your vendor dashboard to see your total sales, active listings, and pending balance.
- **Withdrawals**: Request to withdraw your earnings to your preferred payment method.

### For Admins
- **Admin Panel**: Access `/admin` to view system-wide stats and manage withdrawal requests.
- **Moderation**: Review community posts and marketplace listings to ensure they follow campus guidelines.

## 📂 Project Structure

```text
├── app/                # Next.js App Router routes
│   ├── admin/          # Admin dashboard & management
│   ├── api/            # Backend API endpoints
│   ├── community/      # Community board features
│   ├── products/       # Marketplace & product management
│   ├── vendor/         # Vendor-specific pages
│   └── ...             # Auth, profile, cart, etc.
├── components/         # Reusable UI components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions & Firebase config
│   ├── escrow.ts       # Escrow system logic
│   ├── firebase.ts     # Firebase initialization
│   └── products.ts     # Product data subscriptions
├── public/             # Static assets
├── firestore.rules     # Firestore security rules
└── storage.rules       # Firebase Storage security rules
```

## 🛡️ Security Rules

The system uses strict Firebase Security Rules. To deploy them:

```bash
# Firestore Rules
firebase deploy --only firestore:rules

# Storage Rules
firebase deploy --only storage
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ for the Campus Community.
