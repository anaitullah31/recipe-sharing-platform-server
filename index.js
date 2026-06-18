const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = 5000;

// Middleware
app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion } = require("mongodb");
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
    const recipeCollections = client.db("recipehub").collection("recipes");

    // Users API's
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollections.find({}).toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch users" });
      }
    });

    // Recipes API's
    app.get("/recipes", async (req, res) => {
      try {
        const result = await recipeCollections.find({}).toArray();
        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching recipes:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch recipes",
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
