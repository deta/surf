def mock_stream():
    response = """
    <sources>
    <source>
    <id>1</id>
    <resource_id>1</resource_id>
    <content>Chunk 1</content>
    <metadata>
        <url>https://aavash.com</url>
        <timestamp></timestamp>
    </metadata>
    </source>
    <source>
    <id>2</id>
    <resource_id>1</resource_id>
    <content>Chunk 2</content>
    <metadata>
        <url>https://aavash.com</url>
        <timestamp></timestamp>
    </metadata>
    </source>
    <source>
    <id>3</id>
    <resource_id>2</resource_id>
    <content>Chunk 32</content>
    <metadata>
        <url>https://aava.sh</url>
        <timestamp></timestamp>
    </metadata>
    </source>
    </sources>
    <answer>
    This is an example answer. <citation>1</citation> <citation>2</citation> <citation>3</citation>
    Another example answer. <citation>2</citation> <citation>3</citation>
    </answer>
    """
    for line in response.split("\n"):
        yield line

