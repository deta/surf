import sqlite3

def get_resource(resource_id: str, resource_path: str):
    conn = sqlite3.connect(resource_path)

    c = conn.cursor()
    c.execute("SELECT * FROM resources WHERE id=?", (resource_id,))
    resource = c.fetchone()
    if not resource:
        return None
    
    c.execute("SELECT * FROM resource_metadata WHERE resource_id=?", (resource[0],))
    resource_metadata = c.fetchone()
    conn.close()
    
    metadata = None
    if resource_metadata:
        metadata = {
            "id": resource_metadata[0],
            "resourceId": resource_metadata[1],
            "name": resource_metadata[2],
            "sourceURI": resource_metadata[3],
            "alt": resource_metadata[4],
            "userContext": resource_metadata[5],
        }
    return {
            "id": resource[0],
            "path": resource[1],
            "type": resource[2],
            "createdAt": resource[3],
            "updatedAt": resource[4],
            "deleted": True if resource[5] == 1 else False,
            "metadata": metadata 
        }
