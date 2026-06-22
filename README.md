# 🍽️ RecipeHub — Recipe Sharing Platform (Server)

![Node.js](https://img.shields.io/badge/Node.js-Backend-green)
![Express.js](https://img.shields.io/badge/Express.js-API-lightgrey)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green)
![JWT](https://img.shields.io/badge/JWT-Authentication-orange)

---

### 🔗 API Base URL: https://recipe-sharing-platform-server.vercel.app/

---

## 📖 Project Overview

RecipeHub Server powers the backend infrastructure of the Recipe Sharing Platform.

The server handles:

* Authentication
* Authorization
* Recipe Management
* User Management
* Favorites
* Reports
* Premium Memberships
* Stripe Payments
* Dashboard Analytics

---

## ⚙️ Core Features

### Authentication & Authorization

* Better Auth Integration
* JWT Authentication
* HTTPOnly Cookies
* Protected APIs
* Role-Based Access Control

### User Management

* Create Users
* Update Users
* Block Users
* Unblock Users
* Premium Membership Handling

### Recipe Management

* Create Recipes
* Read Recipes
* Update Recipes
* Delete Recipes
* Feature Recipes
* Like Recipes

### Favorites System

* Add Favorite
* Remove Favorite
* Get Favorites

### Reporting System

* Create Reports
* Resolve Reports
* Remove Reported Recipes

### Payment System

* Stripe Checkout Session
* Premium Membership Payments
* Recipe Purchase Payments
* Transaction Storage

---

## 🛠️ Technologies Used

### Backend

* Node.js
* Express.js
* MongoDB

### Security

* JWT
* HTTPOnly Cookie
* CORS
* Environment Variables

### Payments

* Stripe

---

## 🗄️ Database Collections

### users

```js
{
  name,
  email,
  image,
  role,
  status,
  isPremium,
  createdAt,
  updatedAt
}
```

### recipes

```js
{
  recipeName,
  recipeImage,
  category,
  cuisineType,
  difficultyLevel,
  preparationTime,
  ingredients,
  instructions,
  authorId,
  authorName,
  authorEmail,
  likesCount,
  likedBy,
  isFeatured,
  status,
  createdAt,
  updatedAt
}
```

### favorites

```js
{
  userEmail,
  userId,
  recipeId,
  recipeName,
  recipeImage,
  addedAt
}
```

### reports

```js
{
  recipeId,
  recipeName,
  reporterEmail,
  reason,
  status,
  createdAt
}
```

### payments

```js
{
  userEmail,
  userId,
  amount,
  paymentType,
  paymentStatus,
  transactionId,
  stripeSessionId,
  recipeId,
  recipeName,
  createdAt
}
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
PORT=

MONGODB_URI=

DB_NAME=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

STRIPE_SECRET_KEY=

JWT_SECRET=
CLIENT_URL=
```

---

## 🚀 Installation

```bash
git clone SERVER_REPOSITORY_URL

cd recipehub-server

npm install

npm run dev
```

---

## 🔒 Security Implementations

* JWT Token Validation
* HTTPOnly Cookie Storage
* Role-Based Authorization
* Protected Dashboard APIs
* Environment Variable Protection
* Secure MongoDB Credentials
* Secure Better Auth Configuration

---

## 📈 Admin Analytics

Dashboard provides:

* Total Users
* Total Recipes
* Total Premium Members
* Total Reports
* Transaction Overview

---

## 🌐 Deployment

Deployed using:

* Vercel (Server)

---

## 👨‍💻 Developer

**Anait Ullah**

RecipeHub — Recipe Sharing Platform
