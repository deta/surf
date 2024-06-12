export interface ResourceDataDocument {
  // basic information
  url: string // URL of the document
  title: string | null // the title of the document
  date_created: string // when the document was originally created
  date_edited: string | null // when the document was last edited

  // information about the document editor
  editor_name: string // name of the editor the document was created with
  editor_icon: string // URL to a icon / favicon representing the editor

  // author related information
  author: string | null // who created the document
  author_fullname: string | null // the full name of the author
  author_image: string | null // a image URL of the author / profile picture
  author_url: string | null // a url pointing to the author themselves

  // content related information
  content_plain: string // plain text version of the content
  content_html: string // html representation of the content
}
