import {
    Account,
    Client,
    Databases,
    Functions,
    ID,
    Permission,
    Query,
    Role,
} from 'appwrite';
import { APPWRITE_CONFIG } from './constants';

export class UserSession {
    constructor() {
        this.client = new Client()
            .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
            .setProject(APPWRITE_CONFIG.PROJECT);

        this.account = new Account(this.client);
        this.database = new Databases(this.client);
        this.functions = new Functions(this.client);

        this.uid = null;
        this.sessionInfo = null;
    }

    async login(email, password, router) {
        try {
            let res = await this.account.createEmailSession(email, password);
            this.sessionInfo = res;
            this.uid = res.$id;
            router.push('/');
        } catch (err) {
            this.uid = null;
            this.sessionInfo = null;
            console.error(err);
            alert('Login failed');
        }
    }

    async logout(router) {
        try {
            await this.account.deleteSession('current');
            this.sessionInfo = null;
            this.uid = null;
            router.push('/login');
        } catch (err) {
            console.error(err);
            alert('Logout failed');
        }
    }

    async register(email, password, router) {
        try {
            await this.account.create(ID.unique(), email, password);
            await this.login(email, password, router);
        } catch (err) {
            console.error(err);
            alert('Registration failed');
        }
    }

    async getSession() {
        try {
            let res = await this.account.get();
            this.sessionInfo = res;
            this.uid = res.$id;
            return res;
        } catch (err) {
            this.uid = null;
            this.sessionInfo = null;
            console.error(err);
            return { $id: null };
        }
    }

    async getFeeds() {
        try {
            let feeds = await this.database.listDocuments(
                APPWRITE_CONFIG.FEEDS_DB,
                APPWRITE_CONFIG.NEWS,
                [Query.equal('user_id', this.uid)]
            );

            return feeds.documents;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async createFeed(url) {
        if (this.uid == null) {
            await this.getSession();
        }

        let feed;
        try {
            let res = await this.functions.createExecution(
                APPWRITE_CONFIG.FETCH_ARTICLES,
                JSON.stringify({ type: 'source', urls: [url] }),
                false,
                '/',
                'GET'
            );
            console.log('SOURCE', res);
            let articleSource = JSON.parse(res.response);
            console.log(articleSource);
            articleSource = articleSource.data[0];
            feed = {
                title: articleSource.data.title,
                items: articleSource.data.articles,
            };
        } catch (err) {
            alert('Could not add feed source');
            console.error(err);
            return null;
        }
        if (feed == null) {
            alert('Could not add feed source');
            return null;
        }

        try {
            await this.database.createDocument(
                APPWRITE_CONFIG.FEEDS_DB,
                APPWRITE_CONFIG.NEWS,
                ID.unique(),
                { url: url, user_id: this.uid },
                [
                    Permission.read(Role.user(this.uid)),
                    Permission.write(Role.user(this.uid)),
                    Permission.update(Role.user(this.uid)),
                    Permission.delete(Role.user(this.uid)),
                ]
            );
        } catch (err) {
            console.error(err);
        }
    }

    async deleteFeed(id) {
        try {
            await this.database.deleteDocument(
                APPWRITE_CONFIG.FEEDS_DB,
                APPWRITE_CONFIG.NEWS,
                id
            );
        } catch (err) {
            console.error(err);
        }
    }

    async getArticleSources() {
        const sources = await this.getFeeds();
        const ids = new Map();
        sources.forEach((source) => {
            ids.set(source.url, source.$id);
        });
        const urls = sources.map((source) => source.url);
        if (urls == null) {
            return;
        }

        try {
            let res = await this.functions.createExecution(
                APPWRITE_CONFIG.FETCH_ARTICLES,
                JSON.stringify({ type: 'source', urls: urls }),
                false,
                '/',
                'GET'
            );
            let articleSources = JSON.parse(res.response).data;
            console.log(articleSources);
            let feeds = [];
            for (let source of articleSources) {
                if (source.status != 200) continue;
                feeds.push({
                    id: ids.get(source.data.url),
                    title: source.data.title,
                    items: source.data.articles,
                });
            }
            return feeds;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async getArticle(url, title) {
        try {
            let res = await this.functions.createExecution(
                APPWRITE_CONFIG.FETCH_ARTICLES,
                JSON.stringify({ type: 'article', urls: [url] }),
                false,
                '/',
                'GET'
            );
            let articles_res = JSON.parse(res.response).data[0];
            if (articles_res.status != 200)
                return <div>Error fetching article.</div>;
            let article = articles_res.data;
            let content = [
                <a
                    href={`//${url}`}
                    target="_blank"
                    style={{ color: 'blue', textDecoration: 'underline' }}
                >
                    View original content
                </a>,
                <br />,
                <h1 style={{ textAlign: 'center', margin: '10px' }}>
                    {title}
                </h1>,
                <br />,
            ];
            for (let tag of article.tags) {
                content.push(<p>{tag}</p>);
                content.push(<br />);
            }
            for (let i = 0; i < 15; i++) {
                content.push(<br />);
            }

            return <div>{content}</div>;
        } catch (err) {
            console.error(err);
            return null;
        }
    }
}
