This is the final for my cloud app dev class. It is a REST API running on node.js that is deployed to GCP.
It was deployed to GCP and used Googles OAuth to generate a JWT token for a specifed user.
There are two non-user entities, boats and loads. Boats are protected and require a valid JWT token that is generated after the OAuth work flow. Loads are not protected.
