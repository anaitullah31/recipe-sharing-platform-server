const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = 5000;

// Middleware
app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const userCollections = client.db("recipehub").collection("user");
    const sessionCollections = client.db("recipehub").collection("session");
    const recipeCollections = client.db("recipehub").collection("recipes");
    const favoriteCollections = client.db("recipehub").collection("favorites");
    const reportCollections = client.db("recipehub").collection("reports");
    const paymentCollections = client.db("recipehub").collection("payments");
    const planCollections = client.db("recipehub").collection("plans");

    // Verify Token
    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const query = { token: token };
      const session = await sessionCollections.findOne(query);
      const userId = session?.userId;
      const userQuery = {
        _id: userId,
      };
      const user = await userCollections.findOne(userQuery);
      req.user = user;

      next();
    };

    const verifyUser = async (req, res, next) => {
      if (req?.user?.role !== "user") {
        return res.status(403).send({ message: "forbiden access" });
      }
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      if (req?.user?.role !== "admin") {
        return res.status(403).send({ message: "forbiden access" });
      }
      next();
    };

    // Users API's
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const now = new Date();

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        const users = await userCollections
          .find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalUsers = await userCollections.countDocuments();

        const activeUsers = await userCollections.countDocuments({
          status: "active",
        });

        const newThisWeek = await userCollections.countDocuments({
          createdAt: {
            $gte: sevenDaysAgo,
          },
        });

        res.status(200).send({
          success: true,
          data: users,
          stats: {
            totalUsers,
            activeUsers,
            newThisWeek,
          },
          pagination: {
            total: totalUsers,
            page,
            limit,
            totalPages: Math.ceil(totalUsers / limit),
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(totalUsers / limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Failed to fetch users",
          error: error.message,
        });
      }
    });

    app.get("/users/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid user id",
          });
        }

        const loggedInUser = req.user;

        const isOwner = loggedInUser?._id?.toString() === id;
        const isAdmin = loggedInUser?.role === "admin";

        if (!isOwner && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: "forbidden access",
          });
        }

        const user = await userCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.status(200).json(user);
      } catch (error) {
        console.error("Error fetching user:", error);

        res.status(500).json({
          success: false,
          message: "Failed to fetch user",
        });
      }
    });

    app.patch("/users/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { currentUserEmail, currentUserId } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user id",
          });
        }

        const targetUser = await userCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!targetUser) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        // Cannot block yourself
        if (
          targetUser.email === currentUserEmail ||
          targetUser._id.toString() === currentUserId
        ) {
          return res.status(403).send({
            success: false,
            message: "You cannot block yourself",
          });
        }

        // Cannot block another admin
        if (targetUser.role === "admin") {
          return res.status(403).send({
            success: false,
            message: "Admin users cannot be blocked",
          });
        }

        const newStatus = targetUser.status === "active" ? "blocked" : "active";

        await userCollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: newStatus,
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: `User ${newStatus} successfully`,
          status: newStatus,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Recipes API's
    app.get("/recipes", async (req, res) => {
      try {
        const {
          authorEmail,
          featured,
          popular,
          limit = 8,
          page = 1,
        } = req.query;

        const filter = {};

        if (authorEmail) {
          filter.authorEmail = authorEmail;
        }

        if (featured === "true") {
          filter.isFeatured = true;
        }

        const currentPage = Math.max(Number(page), 1);
        const perPage = Math.max(Number(limit), 1);
        const skip = (currentPage - 1) * perPage;

        let sortOption = { createdAt: -1 };

        if (popular === "true") {
          sortOption = { likesCount: -1 };
        }

        const total = await recipeCollections.countDocuments(filter);

        const recipes = await recipeCollections
          .find(filter)
          .sort(sortOption)
          .skip(skip)
          .limit(perPage)
          .toArray();

        res.send({
          success: true,
          data: recipes,
          pagination: {
            total,
            page: currentPage,
            limit: perPage,
            totalPages: Math.ceil(total / perPage),
            hasPrevPage: currentPage > 1,
            hasNextPage: currentPage < Math.ceil(total / perPage),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/recipes/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid recipe id",
          });
        }

        const recipe = await recipeCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!recipe) {
          return res.status(404).json({
            success: false,
            message: "Recipe not found",
          });
        }

        res.status(200).json({
          success: true,
          data: recipe,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Failed to fetch recipe",
        });
      }
    });

    app.post("/recipes", verifyToken, async (req, res) => {
      try {
        const recipeData = {
          ...req.body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await recipeCollections.insertOne(recipeData);

        res.send({
          success: true,
          message: "Recipe created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

app.patch("/recipes/:id", verifyToken, async (req, res) => {
// ✅ JWT CHANGE END
  try {
    const { id } = req.params;
    const { action, userEmail, updateData } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid recipe id",
      });
    }

    const filter = { _id: new ObjectId(id) };
    const recipe = await recipeCollections.findOne(filter);

    if (!recipe) {
      return res.status(404).send({
        success: false,
        message: "Recipe not found",
      });
    }

    // ✅ JWT CHANGE START
    const loggedInUserEmail = req.user?.email;
    const loggedInUserRole = req.user?.role;

    const isAdmin = loggedInUserRole === "admin";
    const isOwner = recipe.authorEmail === loggedInUserEmail;
    // ✅ JWT CHANGE END

    // Like / Unlike
    if (action === "like") {
      // ✅ JWT CHANGE START
      // Don't trust userEmail from frontend. Use verified JWT user email.
      const verifiedUserEmail = loggedInUserEmail;

      if (!verifiedUserEmail) {
        return res.status(400).send({
          success: false,
          message: "User email is required",
        });
      }

      const alreadyLiked = recipe.likedBy?.includes(verifiedUserEmail);

      if (alreadyLiked) {
        await recipeCollections.updateOne(filter, {
          $pull: { likedBy: verifiedUserEmail },
          $inc: { likesCount: -1 },
        });
        // ✅ JWT CHANGE END

        return res.send({
          success: true,
          liked: false,
          likesCount: Math.max((recipe.likesCount || 1) - 1, 0),
          message: "Recipe unliked",
        });
      }

      await recipeCollections.updateOne(filter, {
        // ✅ JWT CHANGE START
        $addToSet: { likedBy: verifiedUserEmail },
        // ✅ JWT CHANGE END
        $inc: { likesCount: 1 },
      });

      return res.send({
        success: true,
        liked: true,
        likesCount: (recipe.likesCount || 0) + 1,
        message: "Recipe liked",
      });
    }

    // Feature / Unfeature
    if (action === "feature") {
      // ✅ JWT CHANGE START
      if (!isAdmin) {
        return res.status(403).send({
          success: false,
          message: "forbidden access",
        });
      }
      // ✅ JWT CHANGE END

      const newFeaturedStatus = !recipe.isFeatured;

      await recipeCollections.updateOne(filter, {
        $set: {
          isFeatured: newFeaturedStatus,
          updatedAt: new Date().toISOString(),
        },
      });

      return res.send({
        success: true,
        isFeatured: newFeaturedStatus,
        message: newFeaturedStatus
          ? "Recipe marked as featured"
          : "Recipe removed from featured",
      });
    }

    // General recipe update
    if (action === "update") {
      // ✅ JWT CHANGE START
      if (!isAdmin && !isOwner) {
        return res.status(403).send({
          success: false,
          message: "forbidden access",
        });
      }
      // ✅ JWT CHANGE END

      await recipeCollections.updateOne(filter, {
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      });

      return res.send({
        success: true,
        message: "Recipe updated successfully",
      });
    }

    res.status(400).send({
      success: false,
      message: "Invalid action",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

    app.delete("/recipes/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        const recipe = await recipeCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!recipe) {
          return res.status(404).send({
            success: false,
            message: "Recipe not found",
          });
        }

        await recipeCollections.deleteOne({
          _id: new ObjectId(id),
        });

        await reportCollections.updateMany(
          { recipeId: id },
          {
            $set: {
              status: "resolved",
              resolvedAt: new Date().toISOString(),
            },
          },
        );

        res.send({
          success: true,
          message: "Recipe deleted and reports resolved",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Favorites API's
    app.get("/favorites", verifyToken, async (req, res) => {
      try {
        const { userEmail, userId } = req.query;

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!userEmail && !userId) {
          return res.status(400).send({
            success: false,
            message: "userEmail or userId is required",
          });
        }

        const filter = userEmail ? { userEmail } : { userId };

        const totalFavorites = await favoriteCollections.countDocuments(filter);

        const favorites = await favoriteCollections
          .find(filter)
          .sort({ addedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({
          success: true,
          data: favorites,
          pagination: {
            total: totalFavorites,
            page,
            limit,
            totalPages: Math.ceil(totalFavorites / limit),
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(totalFavorites / limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/favorites", verifyToken, async (req, res) => {
      try {
        const { userEmail, userId, recipeId, recipeName, recipeImage } =
          req.body;

        if (!userEmail || !userId || !recipeId) {
          return res.status(400).send({
            success: false,
            message: "Missing required fields",
          });
        }

        const filter = {
          userEmail,
          recipeId,
        };

        const alreadyFavorite = await favoriteCollections.findOne(filter);

        if (alreadyFavorite) {
          await favoriteCollections.deleteOne(filter);

          return res.send({
            success: true,
            favorited: false,
            message: "Recipe removed from favorites",
          });
        }
        const favoriteData = {
          userEmail,
          userId,
          recipeId,
          recipeName,
          recipeImage,
          addedAt: new Date().toISOString(),
        };

        const result = await favoriteCollections.insertOne(favoriteData);

        res.send({
          success: true,
          favorited: true,
          message: "Recipe added to favorites",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.delete("/favorites/:favoriteId", verifyToken, async (req, res) => {
      try {
        const { favoriteId } = req.params;

        if (!ObjectId.isValid(favoriteId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid favorite id",
          });
        }

        const result = await favoriteCollections.deleteOne({
          _id: new ObjectId(favoriteId),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Favorite not found",
          });
        }

        res.send({
          success: true,
          message: "Favorite removed successfully",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Reports API's
    app.get("/reports", verifyToken, async (req, res) => {
      try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const status = req.query.status || "all";

        const skip = (page - 1) * limit;

        const matchStage = {};

        if (status !== "all") {
          matchStage.status = status;
        }

        const pendingCount = await reportCollections.countDocuments({
          status: "pending",
        });

        const resolvedCount = await reportCollections.countDocuments({
          status: "resolved",
        });

        const totalReports = await reportCollections.countDocuments(matchStage);

        const reports = await reportCollections
          .aggregate([
            {
              $match: matchStage,
            },
            {
              $addFields: {
                recipeObjectId: {
                  $convert: {
                    input: "$recipeId",
                    to: "objectId",
                    onError: null,
                    onNull: null,
                  },
                },
              },
            },
            {
              $lookup: {
                from: "recipes",
                localField: "recipeObjectId",
                foreignField: "_id",
                as: "recipe",
              },
            },
            {
              $unwind: {
                path: "$recipe",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                recipeImage: {
                  $ifNull: ["$recipe.recipeImage", "$recipeImage"],
                },
                recipeName: {
                  $ifNull: ["$recipe.recipeName", "$recipeName"],
                },
              },
            },
            {
              $sort: {
                createdAt: -1,
              },
            },
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
          ])
          .toArray();

        res.send({
          success: true,
          data: reports,
          stats: {
            total: totalReports,
            pending: pendingCount,
            resolved: resolvedCount,
          },
          pagination: {
            total: totalReports,
            page,
            limit,
            totalPages: Math.ceil(totalReports / limit),
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(totalReports / limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/reports", verifyToken, async (req, res) => {
      try {
        const { recipeId, recipeName, userEmail, reason, comment } = req.body;

        if (!recipeId || !userEmail || !reason) {
          return res.status(400).send({
            success: false,
            message: "recipeId, userEmail and reason are required",
          });
        }

        const reportData = {
          recipeId,
          recipeName,
          userEmail,
          reason,
          comment: comment || "",
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        const result = await reportCollections.insertOne(reportData);

        res.send({
          success: true,
          message: "Report submitted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.patch("/reports/:id/", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await reportCollections.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "resolved",
              resolvedAt: new Date().toISOString(),
            },
          },
        );

        res.send({
          success: true,
          message: "Report resolved",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Plans API's
    app.get("/plans", verifyToken, async (req, res) => {
      try {
        const plans = await planCollections
          .find({})
          .sort({ price: 1 })
          .toArray();

        res.send({
          success: true,
          data: plans,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Payments API's
    app.get("/payments", verifyToken, async (req, res) => {
      try {
        const { userEmail } = req.query;

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};

        if (userEmail) {
          filter.userEmail = userEmail;
        }

        const totalPayments = await paymentCollections.countDocuments(filter);

        const payments = await paymentCollections
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        const allPayments = await paymentCollections.find(filter).toArray();

        const grossRevenue = allPayments.reduce(
          (total, payment) => total + Number(payment.amount || 0),
          0,
        );

        const activeSubscriptions = allPayments.filter(
          (payment) => payment.paymentType === "premium",
        ).length;

        const successfulPayments = allPayments.filter(
          (payment) => payment.paymentStatus === "paid",
        ).length;

        res.send({
          success: true,
          data: payments,
          stats: {
            grossRevenue,
            activeSubscriptions,
            successfulPayments,
          },
          pagination: {
            total: totalPayments,
            page,
            limit,
            totalPages: Math.ceil(totalPayments / limit),
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(totalPayments / limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/payments", verifyToken, async (req, res) => {
      try {
        const paymentData = {
          ...req.body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await paymentCollections.insertOne(paymentData);

        if (paymentData.paymentType === "premium") {
          await userCollections.updateOne(
            { email: paymentData.userEmail },
            {
              $set: {
                plan: "premium",
                updatedAt: new Date().toISOString(),
              },
            },
          );
        }

        res.status(201).send({
          success: true,
          message:
            paymentData.paymentType === "premium"
              ? "Payment saved and plan upgraded"
              : "Recipe payment saved successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RecipeHub Server is running successfully.");
});

app.listen(port, () => {
  console.log(`RecipeHub server is running on port ${port}`);
});
