function feedSource(title, description, items) {
    return {
        title: title,
        description: description,
        id: 0,
        items: items
    }
}

function feedItem(title, description, link, pubDate, source, imageURL, setArticle) {
    return {
        title: title,
        description: description,
        link: link,
        pubDate: pubDate,
        source: source,
        image: imageURL,
        setArticle: function(){
            setArticle(this);
        }
    }
} 

function xmlToJson(xml) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const json = {};

    const parseNode = (node, parent) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const obj = {};
            const attributes = node.attributes;

            for (let i = 0; i < attributes.length; i++) {
                const attribute = attributes[i];
                obj[attribute.nodeName] = attribute.nodeValue;
            }

            const children = node.childNodes;

            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                parseNode(child, obj);
            }

            if (parent[node.nodeName]) {
                if (!Array.isArray(parent[node.nodeName])) {
                parent[node.nodeName] = [parent[node.nodeName]];
                }
                parent[node.nodeName].push(obj);
            } else {
                parent[node.nodeName] = obj;
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            parent[node.parentNode.nodeName] = node.nodeValue.trim();
        }
    };

    parseNode(xmlDoc.firstChild, json);

    return json;
}

function parseFeed(feed) {
    let feedItems = [];
    for (let item of feed.item) {
        let url = null;
        if (typeof feed.image !== 'undefined' && typeof feed.image.url !== 'undefined') {
            url = feed.image.url.url;
        }
        console.log(item);
        feedItems.push(feedItem(item.title.title, item.description.description, item.link.link, item.pubDate.pubDate, feed.title.title, url));
    }
    return feedItems;
}

function getDate(pubDate) {
    let date = new Date(pubDate);
    return date.getTime();
}

function sortAllFeedItems(feedItems) {
    feedItems.sort((a, b) => {
        let dateA = getDate(a.pubDate);
        let dateB = getDate(b.pubDate)

        if (dateA > dateB) {
            return -1;
        }
        if (dateA < dateB) {
            return 1;
        }
        return 0;
    });
}

async function downloadFeed(url, tries = 0) {
    const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
    let res = await fetch(CORS_PROXY + url)
    let text = await res.text();
    let json = xmlToJson(text);
    if (typeof json.rss === 'undefined') {
        if (tries < 3) {
            setTimeout(() => {
                downloadFeed(url, tries + 1);
            }, 500);
        }
        return null;
    }
    let feedItems = parseFeed(json.rss.channel);
    console.debug(json);

    return feedSource(json.rss.channel.title.title, json.rss.channel.description.description, feedItems);
};

export async function downloadFeeds(urls) {
    let feedSources = [];
    let feedItems = [];
    for (let url of urls) {
        let feedObj = await downloadFeed(url.url);
        if (feedObj == null) {
            continue;
        }
        feedObj.id = url.url;
        feedSources.push(feedObj);
        feedItems = feedItems.concat(feedObj.items);
    }

    sortAllFeedItems(feedItems);

    return {
        sources: feedSources,
        items: feedItems
    };
}

function removeTags(text) {
    return text.replace(/<\/?[^>]+(>|$)/g, "");
}

export async function fetchAndParseHtml(url) {
    const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
    let response;
    try {
        response = await fetch(CORS_PROXY + url);
    } catch(err) {
        console.error(err);
        return (<a href={url} target="_blank">Click here to view content</a>);
    }
    const htmlString = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    let content = [(<a href={url} target="_blank" style={{color: "blue", textDecoration: "underline"}}>View original content</a>), <br/>];
    for (let paragraph of doc.getElementsByTagName('p')) {
        console.log(paragraph.textContent);
        content.push(<p>{paragraph.textContent}</p>);
        content.push(<br/>);
    }
    console.log(content);
    return (<div>{content}</div>);
}