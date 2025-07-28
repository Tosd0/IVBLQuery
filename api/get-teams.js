import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const databaseId = process.env.DATABASE_ID;

  if (!databaseId) {
    return res.status(500).json({ message: "错误：服务器未配置数据库ID (DATABASE_ID)。" });
  }

  try {
    let allTeams = new Set();
    let hasMore = true;
    let startCursor = undefined;

    // 循环获取所有分页数据
    while (hasMore) {
        const response = await notion.databases.query({
            database_id: databaseId,
            start_cursor: startCursor,
            page_size: 100,
        });

        response.results.forEach(page => {
            // 从“主场”和“客场”属性中提取队伍名称
            const homeTeam = page.properties['主场']?.select?.name;
            const awayTeam = page.properties['客场']?.select?.name;
            if (homeTeam) allTeams.add(homeTeam);
            if (awayTeam) allTeams.add(awayTeam);
        });

        hasMore = response.has_more;
        startCursor = response.next_cursor;
    }

    // 返回去重和排序后的队伍列表
    res.status(200).json({ teams: Array.from(allTeams).sort() });

  } catch (error) {
    console.error("获取队伍列表失败:", error);
    res.status(500).json({ message: "服务器内部错误", error: error.message });
  }
}
