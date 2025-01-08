# Use a Debian-based image as the base
FROM debian:bullseye

# Set the working directory
WORKDIR /app

# Update the package list and install dependencies for snapd
RUN apt-get update && apt-get install -y \
    snapd \
    && apt-get clean

# Enable systemd to work with snapd
RUN systemctl enable snapd

# Install Somiibo using snap
RUN snap install somiibo

# Expose any port Somiibo needs (update this if necessary)
EXPOSE 3000

# Set the default command to run Somiibo
CMD ["somiibo"]
