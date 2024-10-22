require("dotenv").config();
const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Author = require("./models/Author");
const Book = require("./models/Book");
const User = require("./schemas/User");
const config = require("./utils/config");
const { GraphQLError } = require("graphql");

// Load environment variables
const { MONGO_URI } = process.env;
const JWT_SECRET = "NEED_HERE_A_SECRET_KEY";

// Connect to MongoDB
const connectDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("connected to MongoDB");
};

// Define GraphQL type definitions
const typeDefs = `
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String!]!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book
    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author
    createUser(
      username: String!
      favoriteGenre: String!
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }
`;

// Define GraphQL resolvers
const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      let filter = {};
      if (args.genre) {
        filter.genres = { $in: [args.genre] };
      }
      if (args.name) {
        const author = await Author.findOne({ name: args.name });
        if (author) {
          filter.author = author._id;
        }
      }
      return Book.find(filter).populate("author");
    },
    allAuthors: async () => {
      const authors = await Author.find({});
      const books = await Book.find({});
      return authors.map((author) => ({
        name: author.name,
        id: author._id,
        born: author.born,
        bookCount: books.filter(
          (book) => book.author.toString() === author._id.toString()
        ).length,
      }));
    },
    me: (root, args, context) => {
      return context.currentUser;
    },
  },
  Mutation: {
    addBook: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        let author = await Author.findOne({ name: args.author });
        if (!author) {
          author = new Author({ name: args.author });
          await author.save();
        }
        const book = new Book({ ...args, author: author._id });
        await book.save();
        return book.populate("author");
      } catch (error) {
        throw new GraphQLError(error.message, {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args },
        });
      }
    },
    editAuthor: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const author = await Author.findOne({ name: args.name });
        if (!author) {
          throw new GraphQLError("Author not found", {
            extensions: { code: "BAD_USER_INPUT", invalidArgs: args.name },
          });
        }
        author.born = args.setBornTo;
        await author.save();
        return author;
      } catch (error) {
        throw new GraphQLError(error.message, {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args },
        });
      }
    },
    createUser: async (root, args) => {
      const user = new User({
        username: args.username,
        favoriteGenre: args.favoriteGenre,
      });

      return user.save().catch((error) => {
        throw new GraphQLError(error.message, {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args },
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== "secred") {
        throw new GraphQLError("wrong credentials", {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args },
        });
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, JWT_SECRET) };
    },
  },
  Author: {
    bookCount: async (parent) => {
      return Book.countDocuments({ author: parent.id });
    },
  },
  Book: {
    author: async (parent) => {
      return Author.findById(parent.author);
    },
  },
};

// Initialize Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start the server
async function startServer() {
  await connectDB();
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => {
      const auth = req ? req.headers.authorization : null;
      if (auth && auth.toLowerCase().startsWith("bearer ")) {
        const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);
        const currentUser = await User.findById(decodedToken.id);
        return { currentUser };
      }
    },
  });
  console.log(`Server ready at ${url}`);
}

startServer();
