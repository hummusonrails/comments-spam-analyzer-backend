import express from 'express';
import couchbase from 'couchbase';
import fetch from 'node-fetch';
import { config as dotenvConfig } from 'dotenv';
import cors from 'cors';

dotenvConfig();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Couchbase Cluster
let cluster;
let bucket;
let collection;
let scope;

async function initCouchbase() {
  try {
    cluster = await couchbase.connect(process.env.COUCHBASE_URL, {
      username: process.env.COUCHBASE_USERNAME,
      password: process.env.COUCHBASE_PASSWORD,
      configProfile: 'wanDevelopment',
    });

    bucket = cluster.bucket(process.env.COUCHBASE_BUCKET);
    collection = bucket.defaultCollection();
    scope = bucket.scope('_default');
    console.log('Connected to Couchbase');
  } catch (error) {
    console.error('Error connecting to Couchbase:', error);
  }
}

initCouchbase();

// Function to generate embedding using OpenAI
async function generateEmbedding(text) {
  console.log('Generating embedding for text:', text);
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    });

    const result = await response.json();
    if (!result.data || !result.data[0].embedding) {
      throw new Error('Failed to generate embedding from OpenAI');
    }
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Endpoint to store embedding
app.post('/store-embedding', async (req, res) => {
  const { comment, blogPostUrl } = req.body;

  if (!comment || !blogPostUrl || !comment.id) {
    return res.status(400).json({ error: 'Missing required fields or comment ID' });
  }

  try {
    const embedding = await generateEmbedding(comment.text);
    const documentKey = `comment::${encodeURIComponent(blogPostUrl)}::${comment.id}`;
    await collection.upsert(documentKey, {
      text: comment.text,
      embedding: embedding,
      blogPostUrl: blogPostUrl,
    });

    console.log(`Stored embedding for comment ${comment.id}`);
    res.json({ success: true, message: `Stored embedding for comment ${comment.id}` });
  } catch (error) {
    console.error('Error storing embedding:', error);
    res.status(500).json({ error: 'Failed to store embedding' });
  }
});

app.post('/analyze-similarity', async (req, res) => {
    const { blogPostUrl, threshold = 0.1 } = req.body;
  
    try {
      // Step 1: Fetch all comments for the blog post
      const query = `
        SELECT meta().id, embedding, text
        FROM \`${process.env.COUCHBASE_BUCKET}\`.\`_default\`.\`_default\`
        WHERE blogPostUrl = $1;
      `;
      const result = await cluster.query(query, { parameters: [blogPostUrl] });
      const comments = result.rows;
  
      if (comments.length === 0) {
        return res.json({ success: true, message: 'No comments found for this post.' });
      }
  
      let similarCommentsCount = 0;
      const totalComments = comments.length;
  
      // Step 2: For each comment, perform a vector search to find similar comments
      for (const comment of comments) {
        const targetEmbedding = comment.embedding;
  
        // Create the search request using VectorQuery with numCandidates for top K results
        const searchRequest = couchbase.SearchRequest.create(
          couchbase.VectorSearch.fromVectorQuery(
            couchbase.VectorQuery.create('embedding', targetEmbedding)
              .numCandidates(10) // top 10 results
          )
        );
  
        const searchResult = await scope.search('blog_comments_vector_search', searchRequest);
  
        searchResult.rows.forEach(row => {
          console.log(`Comment ID: ${row.id}, Score: ${row.score}`);
        });
  
        // Step 3: Check if the top result is within the threshold
        const similarCount = searchResult.rows.filter(row => row.score >= threshold).length;
  
        if (similarCount > 1) { // More than 1 comment found similar (including the comment itself)
          similarCommentsCount += 1;
        }
      }
  
      // Step 4: Calculate the percentages
      const similarPercentage = (similarCommentsCount / totalComments) * 100;
      const dissimilarPercentage = 100 - similarPercentage;
  
      res.json({
        success: true,
        message: `Out of ${totalComments} comments, ${similarCommentsCount} are similar.`,
        similarPercentage: similarPercentage.toFixed(2),
        dissimilarPercentage: dissimilarPercentage.toFixed(2),
      });
    } catch (error) {
      console.error('Error analyzing similarity:', error);
      res.status(500).json({ success: false, message: 'Failed to analyze similarity' });
    }
  });  

app.post('/check-existing-comments', async (req, res) => {
  const { blogPostUrl } = req.body;

  if (!blogPostUrl) {
    return res.status(400).json({ success: false, message: 'Missing blogPostUrl' });
  }

  try {
    const query = `
      SELECT meta().id
      FROM \`${process.env.COUCHBASE_BUCKET}\`.\`_default\`.\`_default\`
      WHERE blogPostUrl = $1;
    `;
    const result = await cluster.query(query, { parameters: [blogPostUrl] });
    const existingCommentIds = result.rows.map(row => row.id);

    res.json({ success: true, existingCommentIds });
  } catch (error) {
    console.error('Error checking existing comments:', error);
    res.status(500).json({ success: false, message: 'Failed to check existing comments' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
