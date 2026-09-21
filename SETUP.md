tutorapp docker setup instructions

docker network create tutorapp-network

docker run --name tutorapp-postgres-container --network tutorapp-network -e POSTGRES_PASSWORD=password -p 5432:5432 -d tutorapp-postgres

docker run --name tutorapp-backend-container -p 8000:8000 -d tutorapp-backend