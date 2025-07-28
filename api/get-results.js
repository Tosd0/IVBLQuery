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
            // 复合筛选：必须同时满足AND中的所有条件
            and: [
                {
                    // 条件1: 比赛状态为 "未着手"
                    property: "比赛状态",
                    status: {
                        equals: "未着手"
                    }
                },
                {
                    // 条件2: 主场或客场是选择的队伍
                    or: [
                        { property: "主场", select: { equals: team } },
                        { property: "客场", select: { equals: team } }
                    ]
                }
            ]
        },
        sorts: [
            {
                property: "日期",
                direction: "ascending"
            }
        ]
    });
    
    // 从返回结果中提取并格式化所需的数据
    const results = response.results.map(page => {
        const properties = page.properties;
        
        // 提取裁判名字，可能有多位裁判
        const referees = properties['裁判']?.people || [];
        const refereeNames = referees.map(person => person.name).join(', ');

        return {
            title: properties['标题']?.title[0]?.plain_text || '无标题',
            time: properties['日期']?.date?.start || '无时间',
            referee: refereeNames || '暂无裁判'
        };
    });

    res.status(200).json({ results });

  } catch (error) {
    console.error(`查询队伍 "${team}" 的赛果失败:`, error);
    res.status(500).json({ message: "服务器内部错误", error: error.message });
  }
}
