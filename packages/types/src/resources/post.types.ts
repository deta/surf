export interface ResourceDataPost {
  // basic information
  post_id: string // unique identifier for the post
  url: string // URL of the post on the original site
  title: string | null // the title of the post
  date_published: string // when the post was originally published
  date_edited: string | null // when the post was last updated / modified
  edited: boolean | null // whether the post was edited

  // information about the site
  site_name: string // name of the site the post was published on
  site_icon: string // URL to a icon / favicon representing the site

  // author related information
  author: string | null // who created the post
  author_fullname: string | null // the full name of the author
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  excerpt: string | null // a summary of the collectables content
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content
  lang: string | null // language content is written in

  // associated media
  images: string[] // URLs to images used/mentioned in the post
  video: string[] // URLs to videos used/mentioned in the post
  links: string[] // URLs to other resources mentioned in the post

  // source / associated groups information
  parent_url: string | null // URL to the parent page/group/section
  parent_title: string | null // title of the parent page/group/section

  // associated statistics
  stats: {
    views: number | null // number of views / clicks etc.
    up_votes: number | null // number of up votes, likes, thumb ups etc.
    down_votes: number | null // number of down votes, dislikes, thumb downs etc.
    comments: number | null // number of comments
  }
}
