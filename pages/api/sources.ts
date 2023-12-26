import axios from 'axios';
import { OpenAIModel, Source } from "@/types";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { NextApiRequest, NextApiResponse } from "next";
import { cleanSourceText } from "../../utils/sources";

// Define an interface for the SERP API result
interface SERPResult {
  link: string;
  // Add other fields as per the SERP API response structure
}


type Data = {
  sources: Source[];
};

const searchHandler = async (req: NextApiRequest, res: NextApiResponse<Data>) => {
  try {
    const { query, model } = req.body as {
      query: string;
      model: OpenAIModel;
    };

    const sourceCount = 4;
    const apiKey = process.env.SERP_API_KEY; // Replace with your actual SERP API key

  // Use SERP API to fetch search results
const serpResponse = await axios.get('https://serpapi.com/search.json', {
  params: {
    q: query,
    api_key: apiKey,
    num: sourceCount,
    hl: 'en'
  }
});

const serpLinks = serpResponse.data.organic_results.map((result: SERPResult) => result.link);


    // SCRAPE TEXT FROM LINKS
    const sources = await Promise.all(serpLinks.map(async (link: string) => {

      try {
        const response = await axios.get(link);
        const html = response.data;
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const parsed = new Readability(doc).parse();

        if (parsed) {
          let sourceText = cleanSourceText(parsed.textContent);
          return { url: link, text: sourceText };
        }
      } catch (error) {
        console.error(`Error fetching content from ${link}:`, error);
        return null;
      }
    }));

    const filteredSources = sources.filter(source => source !== null);

    // Limit the text length for each source
    filteredSources.forEach(source => {
      if (source) {
        source.text = source.text.slice(0, 1500);
      }
    });

    res.status(200).json({ sources: filteredSources });
  } catch (err) {
    console.error('Error in searchHandler:', err);
    res.status(500).json({ sources: [] });
  }
};

export default searchHandler;
