import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { team } = req.query;
  const databaseId = process.env.DATABASE_ID;

  if (!databaseId) {
    return res.status(500).json({ message: "错误：服务器未配置数据库ID (DATABASE_ID)。" });
  }

  if (!team) {
    return res.status(400).json({ message: "缺少“team”参数" });
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: "比赛状态", status: { equals: "未着手" } },
          { or: [
              { property: "主场", select: { equals: team } },
              { property: "客场", select: { equals: team } }
            ]
          }
        ]
      },
      sorts: [
        { property: "日期", direction: "ascending" }
      ]
    });
    
    const results = await Promise.all(response.results.map(async (page) => {
      const properties = page.properties;
      let refereeName = '无裁判。若有裁判已经接手比赛，请让对方尽快填报Notion。';

      const refereeUser = properties['裁判']?.people?.[0];

      if (refereeUser && refereeUser.id) {
        try {
          const userResponse = await notion.users.retrieve({ user_id: refereeUser.id });
          refereeName = userResponse.name || '未知裁判';
        } catch (userError) {
            console.error(`获取裁判(ID: ${refereeUser.id})信息失败:`, userError);
            refereeName = '获取裁判信息失败';
        }
      }

      return {
        title: properties['标题']?.title[0]?.plain_text || '无标题',
        time: properties['日期']?.date?.start || '无时间',
        referee: refereeName
      };
    }));

    res.status(200).json({ results });

  } catch (error) {
    console.error(`查询队伍 "${team}" 的赛果失败:`, error);
    res.status(500).json({ message: "服务器内部错误", error: error.message });
  }
}