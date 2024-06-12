export interface ResourceDataArticle {
  // basic information
  title: string // the title of the article
  url: string // URL of the article
  date_published: string | null // when the article was originally published
  date_updated: string | null // when the document was last updated

  // information about the site the article was published on
  site_name: string // name of the site
  site_icon: string // URL to a icon / favicon representing the site

  // author related information
  author: string | null // who wrote the article
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  excerpt: string | null // a summary of the article
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content
  word_count: number // how many words the content has
  lang: string | null // language content is written in
  direction: string | null // direction the content is written in e.g. ltr/rtl

  // associated media
  images: string[] // URLs to images used/mentioned in the article

  // more information about the category / section / group the article was published under
  category_name: string | null // name of the category
  category_url: string | null // url pointing to the category

  // associated statistics
  stats: {
    views?: number | null // number of views / clicks etc.
    comments?: number | null // number of comments
  }
}
