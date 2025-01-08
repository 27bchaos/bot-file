# Use a Debian-based image as the base
FROM debian:bullseye

# Set the working directory
WORKDIR /app

# Update the package list and install dependencies for downloading and installing the .deb package
RUN apt-get update && apt-get install -y \
    wget \
    sudo \
    apt-transport-https \
    libgbm1 \
    libasound2 \
    && apt-get clean

# Download the Somiibo .deb file directly
RUN wget -O Somiibo_amd64.deb "https://github.com/somiibo/download-server/releases/download/installer/Somiibo_amd64.deb"

# Install the Somiibo .deb package
RUN sudo dpkg -i Somiibo_amd64.deb || sudo apt-get install -f -y

# Expose any port Somiibo needs (update this if necessary)
EXPOSE 3000

# Set the default command to run Somiibo
CMD ["somiibo"]
