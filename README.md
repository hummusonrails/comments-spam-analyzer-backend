# Dev.to Blog Comments Spam Analyzer Backend

This is a Node.js backend server that uses [OpenAI](https://openai.com) to generate vector embeddings for the comments on the blog post, and then uses [Couchbase](https://couchbase.com) to store the embeddings and perform a vector similarity search on them and return a ranking of the comments based on that similarity score. It must be paired with the [Chrome Extension](https://www.github.com/hummusonrails/comments-spam-analyzer) that sends a request to this backend server to analyze the comments on the blog post and display the results in the extension window.

<img src="demo_walkthrough.gif" alt="Extension Example" width="50%">

## Usage

To use the extension, you must first install the extension. Please visit the extension repository [here](https://www.github.com/hummusonrails/comments-spam-analyzer) for instructions on how to install the extension.

## Installation

To install the backend server, you must first clone the repository and install the dependencies.

```bash
npm install
```

Copy the `.env.example` file to `.env` and fill in the necessary environment variables.

```bash
cp .env.example .env
```

To run the server, use the following command:

```bash
npm start
```

## Environment Variables

The following environment variables are required to run the server:

- `OPENAI_API_KEY`: Your OpenAI API key
- `COUCHBASE_URL`: The Couchbase connection string
- `COUCHBASE_USERNAME`: The username of your Couchbase credentials
- `COUCHBASE_PASSWORD`: The password of your Couchbase credentials
- `COUCHBASE_BUCKET`: The Couchbase bucket you want to use

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.
