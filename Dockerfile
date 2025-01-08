# Use a Debian-based image as the base
FROM debian:bullseye

# Set the working directory
WORKDIR /app

# Update the package list and install dependencies for dpkg
RUN apt-get update && apt-get install -y \
    wget \
    sudo \
    apt-transport-https \
    && apt-get clean

# Download the Somiibo .deb file directly
RUN wget -O somiibo_amd64.deb "https://somiibo.com/download/somiibo_amd64.deb"

# Install the Somiibo .deb package
RUN sudo dpkg -i somiibo_amd64.deb || sudo apt-get install -f -y

# Expose any port Somiibo needs (update this if necessary)
EXPOSE 3000

# Set the default command to run Somiibo
CMD ["somiibo"]
